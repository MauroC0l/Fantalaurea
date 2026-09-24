import { mount } from 'svelte'
import './ui/theme/tokens.css'
import './ui/theme/base.css'
import App from './App.svelte'

mount(App, { target: document.getElementById('app')! })
