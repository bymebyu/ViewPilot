# Política de Privacidad de ViewPilot

> [English](privacy-policy.md) | [한국어](privacy-policy-ko.md) | [日本語](privacy-policy-ja.md) | [中文](privacy-policy-zh.md) | [**Español**](privacy-policy-es.md)

**Última actualización: 21 de marzo de 2026**

## Descripción general

ViewPilot es una extensión de navegador que permite interactuar con GitHub Copilot para el contenido de páginas web. Esta política de privacidad explica qué datos se procesan y cómo se utilizan.

**ViewPilot NO es un producto oficial de GitHub o Microsoft.** Se requiere una suscripción válida a GitHub Copilot para usar esta extensión.

## Datos que recopilamos

**No recopilamos ningún dato.** ViewPilot no tiene un servidor operado por el desarrollador y no transmite ninguna información al desarrollador.

## Datos almacenados localmente

Los siguientes datos se almacenan exclusivamente en su dispositivo usando `chrome.storage.local`:

- **Token OAuth de GitHub**: Se utiliza para autenticarse con la API de GitHub Copilot. Se almacena solo en el almacenamiento local de su navegador y nunca se transmite a terceros.
- **Historial de chat**: El historial de conversaciones se almacena solo en el almacenamiento local de su navegador.
- **Preferencias del usuario**: Modelo de IA seleccionado, idioma, tamaño de fuente y configuración de búsqueda web.
- **Claves API de búsqueda web** (opcional): Si proporciona claves API de Brave o Serper, se almacenan localmente y solo se envían a sus respectivos servicios.

## Datos enviados a servicios externos

- **API de GitHub Copilot** (`api.githubcopilot.com`): Al enviar un mensaje, su consulta y el contexto de la página se envían a la API de GitHub Copilot para el procesamiento de IA.
- **Búsqueda web** (cuando está habilitada): Las consultas de búsqueda se envían a uno de los siguientes servicios según su configuración:
  - **DuckDuckGo** (predeterminado, no requiere clave API)
  - **Brave Search** (opcional, requiere clave API)
  - **Serper / Google** (opcional, requiere clave API)

  Solo se envía el texto de la consulta de búsqueda. No se transmiten datos personales, historial de navegación ni contenido de la página a los proveedores de búsqueda.

Toda la comunicación con la API de GitHub Copilot está sujeta a las políticas de privacidad de GitHub. Consulte la [Declaración de Privacidad de GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement) para más detalles.

## Servicios de terceros

ViewPilot se comunica con:
- **API de GitHub Copilot** — funcionalidad de chat de IA
- **DuckDuckGo / Brave / Serper** — búsqueda web opcional (solo cuando el usuario la habilita explícitamente)

No nos integramos con ningún servicio de análisis, seguimiento o publicidad.

## Su control

- Puede borrar su historial de chat y datos almacenados en cualquier momento a través de la extensión.
- Puede revocar el token OAuth de GitHub a través de la configuración de su cuenta de GitHub.
- Desinstalar la extensión elimina todos los datos almacenados localmente.

## Cambios en esta política

Podemos actualizar esta política de privacidad de vez en cuando. Los cambios se publicarán en esta página con una fecha de revisión actualizada.

## Contacto

Si tiene preguntas o inquietudes sobre esta política de privacidad, abra un issue en nuestro [repositorio de GitHub](https://github.com/bymebyu/ViewPilot/issues).

---

*ViewPilot es desarrollado por Gil Chang Lee (bymebyu).*
