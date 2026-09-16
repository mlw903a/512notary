import {ZONES} from './schedule.mjs';

// One reversible runtime setting. All historical zones remain readable.
export const isHaas = env => env.PILOT_BRAND === 'haas';
export function activeZones(env) {
  const zips = isHaas(env) ? ['78602','78621','78653'] : ['78732','78653','78602'];
  return Object.fromEntries(zips.map(zip => [zip,ZONES[zip]]));
}
export function brandAsset(body,env) {
  if(!isHaas(env))return body;
  return body
    .replaceAll('512notary','haasnotary').replaceAll('512Notary','Haas Notary')
    .replaceAll('>512</span>','>haas</span>')
    .replaceAll('Northwest Austin','Elgin').replaceAll('78732','78621')
    .replaceAll('78621 & nearby','78621')
    .replaceAll('Elgin, Manor, Bastrop','Bastrop, Elgin, Manor')
    .replaceAll('Elgin · Manor · Bastrop','Bastrop · Elgin · Manor')
    .replaceAll('Mark · Elgin','Mark · Northwest Austin (legacy)')
    .replaceAll('Haydn · Manor / Bastrop','Haydn · Bastrop / Elgin / Manor')
    .replaceAll('<option value="haydn">','<option value="haydn" selected>');
}
