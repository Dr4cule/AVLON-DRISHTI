import firstLight from '../scenarios/scripted/01-first-light.json';
import urbanEcho from '../scenarios/scripted/02-urban-echo.json';
import afterDark from '../scenarios/scripted/03-after-dark.json';
import falsePositives from '../scenarios/scripted/04-false-positives.json';
import familiarStranger from '../scenarios/scripted/05-familiar-stranger.json';
import manyAsOne from '../scenarios/scripted/06-many-as-one.json';
import nightfall from '../scenarios/scripted/07-nightfall.json';
import brokenSignal from '../scenarios/scripted/08-broken-signal.json';
import nightCourier from '../scenarios/scripted/09-night-courier.json';
import wireInFog from '../scenarios/scripted/10-wire-in-the-fog.json';
import { assertScenario } from './validation';
import type { Scenario } from './types';

export const SCRIPTED_SCENARIOS: Scenario[] = [firstLight, urbanEcho, afterDark, falsePositives, familiarStranger, manyAsOne, nightfall, brokenSignal, nightCourier, wireInFog].map(value => { assertScenario(value); return value; });
