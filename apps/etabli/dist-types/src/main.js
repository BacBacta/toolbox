import { jsx as _jsx } from "preact/jsx-runtime";
import './app.css';
import { render } from 'preact';
import { App } from './app.js';
const racine = document.getElementById('app');
if (racine !== null)
    render(_jsx(App, {}), racine);
