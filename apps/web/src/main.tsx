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
  /*
   * Une mise à jour doit arriver pendant la visite, pas à la suivante.
   *
   * Le nouveau service worker s'installe et prend la main en arrière-plan,
   * mais la page, elle, a déjà chargé l'ancien code : sans rechargement,
   * l'utilisateur qui ouvre l'application pour voir ce qui a changé ne voit
   * rien changer. C'est ce qui s'est passé.
   *
   * Deux garde-fous. `controller` non nul veut dire qu'un service worker
   * servait déjà cette page : à la première visite il n'y a rien à remplacer,
   * et recharger ne ferait qu'un clignotement. Et on ne recharge pas sous les
   * doigts de quelqu'un qui est en train de saisir — l'état est enregistré à
   * chaque changement, mais un nom à demi tapé, lui, ne l'est pas encore. La
   * mise à jour attendra la prochaine ouverture.
   */
  const remplaceUnAncien = navigator.serviceWorker.controller !== null
  let rechargement = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!remplaceUnAncien || rechargement) return
    const actif = document.activeElement
    if (actif instanceof HTMLInputElement || actif instanceof HTMLTextAreaElement) return
    rechargement = true
    location.reload()
  })

  addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Pas de service worker : l'application marche, elle ne marchera juste
      // pas hors ligne. Ce n'est pas une raison de casser la page.
    })
  })
}
