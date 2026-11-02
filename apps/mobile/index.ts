import 'react-native-url-polyfill/auto';
// Defines the background location task before anything else (iOS may start the app for it).
import './src/tracker/task';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
