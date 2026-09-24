# Cuaderno del Profesor - DEV

Proyecto de desarrollo del **Cuaderno del Profesor** basado en:

* Google Sheets
* Google Apps Script
* `clasp`
* Git / GitHub
* Visual Studio Code
* Codex

El Google Sheet `CP_DEV` es el entorno de desarrollo.
El código se edita localmente y se sincroniza con su proyecto Apps Script mediante `clasp`.

---

## 1. Arquitectura

```text
VS Code / Codex
      │
      ├── Git → GitHub
      │
      └── clasp push
              │
              ▼
        Google Apps Script
              │
              ▼
        Google Sheet CP_DEV
```

GitHub sincroniza el código entre ordenadores.

`clasp` sincroniza el código local con Google Apps Script.

---

## 2. Requisitos

Comprobar:

```powershell
git --version
node --version
npm --version
clasp --version
```

Requisitos utilizados inicialmente:

```text
Git:   2.45+
Node:  20+
npm
clasp: 3.x
```

Instalar `clasp`:

```powershell
npm install @google/clasp -g
```

---

## 3. Activar Google Apps Script API

Con la cuenta Google propietaria de `CP_DEV`, abrir:

```text
script.google.com/home/usersettings
```

Activar:

```text
Google Apps Script API
```

Después autenticar `clasp`:

```powershell
clasp login
```

Autorizar utilizando la cuenta de Google del trabajo.

---

## 4. Proyecto Google

En Google Drive:

```text
Cuaderno del Profesor - DEV/
└── CP_DEV
```

`CP_DEV` es un Google Sheet.

Abrir:

```text
Extensiones → Apps Script
```

En:

```text
Configuración del proyecto → IDs
```

copiar el **Script ID**.

---

## 5. Descargar por primera vez el proyecto Apps Script

Crear la carpeta local:

```powershell
mkdir C:\Proyectos\cuaderno-profesor
cd C:\Proyectos\cuaderno-profesor
```

Clonar el proyecto Apps Script:

```powershell
clasp clone-script SCRIPT_ID
```

Esto crea, entre otros:

```text
.clasp.json
appsscript.json
*.gs
*.html
```

`.clasp.json` identifica el proyecto Apps Script remoto.

---

## 6. Git

Inicializar Git:

```powershell
git init -b main
```

Crear un repositorio privado en GitHub, por ejemplo:

```text
cuaderno-profesor-dev
```

Asociarlo:

```powershell
git remote add origin URL_REPOSITORIO
```

Comprobar:

```powershell
git remote -v
```

Primer commit:

```powershell
git add .
git commit -m "Configura proyecto inicial CP_DEV"
git push -u origin main
```

---

## 7. `.gitignore`

No subir credenciales ni archivos privados.

Contenido recomendado:

```gitignore
.clasprc.json
node_modules/
.env
```

**Sí se versiona `.clasp.json`**, ya que permite que todas las copias locales del repositorio apunten al mismo proyecto Apps Script.

**Nunca se versiona `.clasprc.json`**, porque contiene credenciales OAuth de `clasp`.

---

## 8. Sincronizar código con Apps Script

Subir el código local a Google Apps Script:

```powershell
clasp push
```

Descargar el código existente en Apps Script:

```powershell
clasp pull
```

Abrir directamente el proyecto Apps Script en el navegador:

```powershell
clasp open-script
```

Consultar qué archivos detectará `clasp`:

```powershell
clasp show-file-status
```

---

## 9. ¿Hay que compilar?

No.

Mientras el proyecto utilice directamente:

```text
.gs
.html
appsscript.json
```

no existe un paso de compilación.

El flujo normal es simplemente:

```powershell
clasp push
```

Si en el futuro se utiliza TypeScript u otro proceso de build, se documentará por separado.

---

## 10. Flujo normal de trabajo

Al empezar a trabajar:

```powershell
git pull
```

Editar el proyecto con VS Code / Codex.

Revisar cambios:

```powershell
git status
git diff
```

Sincronizar con Apps Script:

```powershell
clasp push
```

Probar los cambios en `CP_DEV`.

Si funcionan:

```powershell
git add .
git commit -m "Descripción del cambio"
git push
```

Flujo resumido:

```text
git pull
↓
editar
↓
clasp push
↓
probar CP_DEV
↓
git add .
git commit
git push
```

---

## 11. Uso de `clasp pull`

Normalmente GitHub será la fuente de verdad del código.

Por tanto, se evitará editar código directamente desde el editor web de Apps Script.

`clasp pull` se utilizará principalmente cuando se haya realizado deliberadamente algún cambio desde el editor web y queramos recuperarlo localmente.

---

## 12. Configurar un segundo ordenador

Instalar:

```text
Git
Node.js
npm
clasp
VS Code
Codex
```

Autenticar Google:

```powershell
clasp login
```

Clonar GitHub:

```powershell
cd C:\Proyectos
git clone URL_REPOSITORIO
cd cuaderno-profesor-dev
```

Como `.clasp.json` está versionado, el proyecto ya conocerá su `Script ID`.

Comprobar conexión:

```powershell
clasp open-script
```

A partir de ese momento:

```powershell
git pull
```

trae el código más reciente de GitHub y:

```powershell
clasp push
```

lo sincroniza con Apps Script.

---

## 13. Reglas importantes

No introducir datos reales de alumnado en `CP_DEV`.

No subir credenciales a GitHub.

No editar simultáneamente los mismos archivos en Apps Script web y VS Code.

Antes de empezar a trabajar en cualquiera de los ordenadores:

```powershell
git pull
```

Antes de considerar terminado un cambio:

```powershell
clasp push
```

y probarlo en `CP_DEV`.

Después guardar la versión:

```powershell
git add .
git commit -m "..."
git push
```

---

## 14. Comandos rápidos

```powershell
# Descargar cambios desde GitHub
git pull

# Ver cambios locales
git status
git diff

# Subir código a Apps Script
clasp push

# Descargar código desde Apps Script
clasp pull

# Abrir Apps Script
clasp open-script

# Ver archivos gestionados por clasp
clasp show-file-status

# Guardar cambios en Git
git add .
git commit -m "Descripción"
git push
```

---

## 15. Fuente de verdad

Para este proyecto:

```text
GitHub = fuente de verdad del código
CP_DEV = entorno de ejecución y pruebas
Google Apps Script = destino sincronizado mediante clasp
```

El Google Sheet real utilizado durante el curso será una copia independiente de `CP_DEV` y no formará parte del flujo de desarrollo.
