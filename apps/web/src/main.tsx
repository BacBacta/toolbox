import '@a237/render/styles/a4.css'
import '@a237/render/styles/outil.css'
import './app.css'

import { render } from 'preact'
import { App } from './app.js'

const racine = document.getElementById('app')
if (racine !== null) render(<App />, racine)

/**
 * Le service worker est enregistré après le premier rendu : il sert les visites
 * suivantes, pas celle-ci, et rien ne justifie de retarder l'affichage pour lui.
 */
if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Pas de service worker : l'application marche, elle ne marchera juste
      // pas hors ligne. Ce n'est pas une raison de casser la page.
    })
  })
}
