#!/usr/bin/env python3
"""Tareas de App Store Connect con la API (sin abrir la web). Lo usa el workflow «iOS App Store».

Uso: python3 asc.py <accion>
  testflight-publico  Crea (o reutiliza) el grupo externo «Público» con enlace público, rellena la
                      información de prueba, añade la última compilación válida y la envía a la
                      revisión beta de Apple. Escribe el enlace público en el resumen.
  bundle-id           Registra el App ID de la extensión de la Live Activity si no existe (lo usa
                      «iOS TestFlight» antes de compilar, para que la firma automática encuentre su perfil).
  revision            Prepara la versión APP_VERSION en el App Store (la crea si no existe),
                      le pone la última compilación válida de esa versión y la envía a revisión.
                      La publicación sigue siendo manual (Guillermo decide cuándo sale).

Entorno: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_FILE (ruta del .p8), APP_VERSION, NOTAS (opcional).
Los datos del revisor (teléfono, cuenta de prueba) se copian de la ficha del App Store: no se
escriben aquí ni salen en el registro.
"""
import json, os, sys, time, urllib.request, urllib.error
import jwt  # pyjwt[crypto]

APP_ID = '6837420283'
API = 'https://api.appstoreconnect.apple.com'
GROUP = 'Público'
LOCALE = 'es-ES'


def token():
    key = open(os.environ['ASC_KEY_FILE']).read()
    now = int(time.time())
    return jwt.encode({'iss': os.environ['ASC_ISSUER_ID'], 'iat': now, 'exp': now + 1100, 'aud': 'appstoreconnect-v1'},
                      key, algorithm='ES256', headers={'kid': os.environ['ASC_KEY_ID'], 'typ': 'JWT'})


TOK = None


def call(method, path, body=None, ok404=False):
    global TOK
    TOK = TOK or token()
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': 'Bearer ' + TOK, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        if ok404 and e.code == 404:
            return None
        detail = e.read().decode(errors='replace')
        # Sin datos personales: Apple solo devuelve códigos y textos de error
        sys.exit(f'::error::{method} {path.split("?")[0]} -> {e.code}: {detail[:1500]}')


def summary(text):
    print(text)
    f = os.environ.get('GITHUB_STEP_SUMMARY')
    if f:
        open(f, 'a').write(text + '\n')


def review_source():
    """Datos de contacto y cuenta de prueba de la ficha del App Store (la versión más reciente)."""
    vers = call('GET', f'/v1/apps/{APP_ID}/appStoreVersions?limit=5')['data']
    for v in vers:
        d = call('GET', f'/v1/appStoreVersions/{v["id"]}/appStoreReviewDetail', ok404=True)
        if d and d.get('data'):
            return d['data']['attributes']
    sys.exit('::error::No encuentro la información para el revisor en la ficha del App Store.')


def last_build(version=None):
    q = f'/v1/builds?filter[app]={APP_ID}&filter[processingState]=VALID&sort=-uploadedDate&limit=20&include=preReleaseVersion'
    if version:
        q += f'&filter[preReleaseVersion.version]={version}'
    r = call('GET', q)
    builds = [b for b in r['data'] if not b['attributes'].get('expired')]
    if not builds:
        sys.exit('::error::No hay ninguna compilación válida' + (f' de la versión {version}' if version else '') + '.')
    return builds[0]


def testflight_publico():
    src = review_source()
    # Información de prueba (localización beta del app)
    desc = ('Hierro es un diario de gimnasio: apunta tus series, sigue tus rutinas, mira tus récords y '
            'compártelos con tus amigos. Se puede usar sin cuenta; para lo social hace falta crear una.')
    attrs = {'feedbackEmail': 'soporte.hierro.app@gmail.com', 'description': desc,
             'marketingUrl': 'https://guillemarmu.github.io/hierro/',
             'privacyPolicyUrl': 'https://guillemarmu.github.io/hierro/privacidad.html'}
    locs = call('GET', f'/v1/apps/{APP_ID}/betaAppLocalizations')['data']
    loc = next((l for l in locs if l['attributes']['locale'] == LOCALE), None)
    if loc:
        call('PATCH', f'/v1/betaAppLocalizations/{loc["id"]}', {'data': {'type': 'betaAppLocalizations', 'id': loc['id'], 'attributes': attrs}})
    else:
        call('POST', '/v1/betaAppLocalizations', {'data': {'type': 'betaAppLocalizations', 'attributes': dict(attrs, locale=LOCALE),
                                                            'relationships': {'app': {'data': {'type': 'apps', 'id': APP_ID}}}}})
    # Información para la revisión beta (copiada de la ficha del App Store)
    rev = {k: src.get(k) for k in ('contactFirstName', 'contactLastName', 'contactPhone', 'contactEmail',
                                   'demoAccountName', 'demoAccountPassword', 'demoAccountRequired')}
    rev['notes'] = ('Hierro funciona sin cuenta. Para lo social (feed, clanes, perfiles, denunciar y bloquear, borrar la cuenta), '
                    'Perfil › «Crear cuenta o entrar» con la cuenta de prueba.')
    call('PATCH', f'/v1/betaAppReviewDetails/{APP_ID}', {'data': {'type': 'betaAppReviewDetails', 'id': APP_ID, 'attributes': rev}})
    # Grupo externo con enlace público
    groups = call('GET', f'/v1/apps/{APP_ID}/betaGroups?limit=50')['data']
    g = next((x for x in groups if x['attributes']['name'] == GROUP), None)
    gattrs = {'publicLinkEnabled': True, 'publicLinkLimitEnabled': False, 'feedbackEnabled': True}
    if not g:
        g = call('POST', '/v1/betaGroups', {'data': {'type': 'betaGroups', 'attributes': dict(gattrs, name=GROUP),
                                                     'relationships': {'app': {'data': {'type': 'apps', 'id': APP_ID}}}}})['data']
    else:
        g = call('PATCH', f'/v1/betaGroups/{g["id"]}', {'data': {'type': 'betaGroups', 'id': g['id'], 'attributes': gattrs}})['data']
    # Última compilación: notas para los testers, al grupo y a la revisión beta
    b = last_build()
    num = b['attributes']['version']
    notas = os.environ.get('NOTAS') or 'Prueba Hierro y cuéntanos qué mejorarías en soporte.hierro.app@gmail.com.'
    bl = call('GET', f'/v1/builds/{b["id"]}/betaBuildLocalizations')['data']
    bloc = next((l for l in bl if l['attributes']['locale'] == LOCALE), None)
    if bloc:
        call('PATCH', f'/v1/betaBuildLocalizations/{bloc["id"]}', {'data': {'type': 'betaBuildLocalizations', 'id': bloc['id'], 'attributes': {'whatsNew': notas}}})
    else:
        call('POST', '/v1/betaBuildLocalizations', {'data': {'type': 'betaBuildLocalizations', 'attributes': {'locale': LOCALE, 'whatsNew': notas},
                                                             'relationships': {'build': {'data': {'type': 'builds', 'id': b['id']}}}}})
    call('POST', f'/v1/betaGroups/{g["id"]}/relationships/builds', {'data': [{'type': 'builds', 'id': b['id']}]})
    st = call('GET', f'/v1/builds/{b["id"]}/betaAppReviewSubmission', ok404=True)
    if not (st and st.get('data')):
        call('POST', '/v1/betaAppReviewSubmissions', {'data': {'type': 'betaAppReviewSubmissions',
                                                               'relationships': {'build': {'data': {'type': 'builds', 'id': b['id']}}}}})
        estado = 'enviada a la revisión beta de Apple'
    else:
        estado = 'ya estaba en la revisión beta (' + st['data']['attributes'].get('betaReviewState', '?') + ')'
    g = call('GET', f'/v1/betaGroups/{g["id"]}')['data']
    summary(f'### TestFlight público\nCompilación {num}: {estado}.\n\nEnlace público: {g["attributes"].get("publicLink") or "(aparece cuando Apple aprueba la revisión beta)"}')


def revision():
    ver = os.environ['APP_VERSION']
    src = review_source()  # comprueba que hay datos para el revisor
    b = last_build(ver)
    vers = call('GET', f'/v1/apps/{APP_ID}/appStoreVersions?filter[platform]=IOS&limit=10')['data']
    v = next((x for x in vers if x['attributes']['versionString'] == ver), None)
    if v and v['attributes']['appStoreState'] not in ('PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED'):
        sys.exit(f'::error::La versión {ver} está en estado {v["attributes"]["appStoreState"]}: no se puede enviar otra vez.')
    if not v:
        v = call('POST', '/v1/appStoreVersions', {'data': {'type': 'appStoreVersions',
                 'attributes': {'platform': 'IOS', 'versionString': ver, 'releaseType': 'MANUAL'},
                 'relationships': {'app': {'data': {'type': 'apps', 'id': APP_ID}}}}})['data']
        # Lo que hay de nuevo (obligatorio desde la segunda versión)
        notas = os.environ.get('NOTAS') or f'Hierro {ver}: mejoras y correcciones.'
        for l in call('GET', f'/v1/appStoreVersions/{v["id"]}/appStoreVersionLocalizations')['data']:
            call('PATCH', f'/v1/appStoreVersionLocalizations/{l["id"]}', {'data': {'type': 'appStoreVersionLocalizations', 'id': l['id'], 'attributes': {'whatsNew': notas}}})
        # La información para el revisor se copia de la versión anterior
        rev = {k: src.get(k) for k in ('contactFirstName', 'contactLastName', 'contactPhone', 'contactEmail',
                                       'demoAccountName', 'demoAccountPassword', 'demoAccountRequired', 'notes')}
        call('POST', '/v1/appStoreReviewDetails', {'data': {'type': 'appStoreReviewDetails', 'attributes': rev,
             'relationships': {'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': v['id']}}}}})
    call('PATCH', f'/v1/appStoreVersions/{v["id"]}/relationships/build', {'data': {'type': 'builds', 'id': b['id']}})
    sub = call('POST', '/v1/reviewSubmissions', {'data': {'type': 'reviewSubmissions', 'attributes': {'platform': 'IOS'},
               'relationships': {'app': {'data': {'type': 'apps', 'id': APP_ID}}}}})['data']
    call('POST', '/v1/reviewSubmissionItems', {'data': {'type': 'reviewSubmissionItems',
         'relationships': {'reviewSubmission': {'data': {'type': 'reviewSubmissions', 'id': sub['id']}},
                           'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': v['id']}}}}})
    call('PATCH', f'/v1/reviewSubmissions/{sub["id"]}', {'data': {'type': 'reviewSubmissions', 'id': sub['id'], 'attributes': {'submitted': True}}})
    summary(f'### App Store\nVersión {ver} con la compilación {b["attributes"]["version"]} enviada a revisión. Publicación manual: sale cuando la publiques en App Store Connect.')


LIVE_BUNDLE = 'io.github.guillemarmu.hierro.HierroLive'


def bundle_id():
    r = call('GET', f'/v1/bundleIds?filter[identifier]={LIVE_BUNDLE}&filter[platform]=IOS&limit=20')
    if any(b['attributes']['identifier'] == LIVE_BUNDLE for b in r['data']):
        print(f'{LIVE_BUNDLE} ya estaba registrado')
        return
    call('POST', '/v1/bundleIds', {'data': {'type': 'bundleIds', 'attributes': {
        'identifier': LIVE_BUNDLE, 'name': 'Hierro Live Activity', 'platform': 'IOS'}}})
    summary(f'App ID `{LIVE_BUNDLE}` registrado (extensión de la Live Activity).')


if __name__ == '__main__':
    acc = sys.argv[1] if len(sys.argv) > 1 else ''
    {'testflight-publico': testflight_publico, 'revision': revision, 'bundle-id': bundle_id}.get(acc, lambda: sys.exit('Acción desconocida: ' + acc))()
