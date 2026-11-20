import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'

// Galería del sistema de diseño: solo en desarrollo, fuera de los proveedores de datos,
// para que se pueda revisar aunque la capa de datos no esté lista.
const showGallery = import.meta.env.DEV && window.location.hash.startsWith('#/dev/ui')

const App = lazy(() => import('./App'))
const UiGallery = import.meta.env.DEV ? lazy(() => import('./features/dev/UiGallery')) : null

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <Suspense fallback={null}>{showGallery && UiGallery ? <UiGallery /> : <App />}</Suspense>
    </HashRouter>
  </React.StrictMode>
)
