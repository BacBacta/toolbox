/**
 * Vite sait importer une feuille de style pour son effet de bord ; TypeScript
 * ne le sait pas. Trois lignes valent mieux qu'une dépendance de types.
 */
declare module '*.css'
