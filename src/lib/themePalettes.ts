export type ThemeMode = 'dark' | 'light';

export const DEFAULT_PALETTE_ID = 'jade_mono';
export const THEME_MODE_KEY = 'eta.theme.mode';
export const THEME_PALETTE_KEY = 'eta.theme.palette';

interface PaletteColors {
  a: string;
  b: string;
  c: string;
}

export interface ThemePalette {
  id: string;
  label: string;
  dark: PaletteColors;
  light: PaletteColors;
}

export const THEME_PALETTES: ThemePalette[] = [
  { id: 'eta_standard', label: 'ETA Standard', dark: { a: '#AED83C', b: '#152B35', c: '#5C8EA0' }, light: { a: '#AED83C', b: '#82A8BA', c: '#5C8EA0' } },
  { id: 'ocean_pulse', label: 'Ozean-Puls', dark: { a: '#55A8FF', b: '#1E3531', c: '#8B80F9' }, light: { a: '#55A8FF', b: '#7CC8BE', c: '#8B80F9' } },
  { id: 'amber_signal', label: 'Bernstein-Signal', dark: { a: '#E4AE34', b: '#091F29', c: '#F06292' }, light: { a: '#E4AE34', b: '#78B2CA', c: '#F06292' } },
  { id: 'raspberry_velvet', label: 'Himbeer-Samt', dark: { a: '#B24C70', b: '#251F11', c: '#D577A4' }, light: { a: '#9B415F', b: '#B0A180', c: '#C96C96' } },
  { id: 'duo_neon', label: 'Duo-Neon', dark: { a: '#96E255', b: '#1A270D', c: '#E4529B' }, light: { a: '#96E255', b: '#C5E29A', c: '#E4529B' } },
  { id: 'infrared_blueprint', label: 'Infrarot-Blueprint', dark: { a: '#FF4E64', b: '#161E3F', c: '#39D6FF' }, light: { a: '#CF344C', b: '#A9B5E8', c: '#188DAE' } },
  { id: 'jade_clay', label: 'Jade & Ton', dark: { a: '#35CFA2', b: '#2C2118', c: '#D36A3A' }, light: { a: '#238F74', b: '#BFA58E', c: '#B6532E' } },
  { id: 'violet_cream', label: 'Violett-Creme', dark: { a: '#C084FC', b: '#2B183A', c: '#F4D35E' }, light: { a: '#7E4BC2', b: '#CDB9E8', c: '#C08B16' } },
  { id: 'pearl_graphite', label: 'Perle & Graphit', dark: { a: '#E6E0C8', b: '#20242A', c: '#FF5A36' }, light: { a: '#655F51', b: '#B8BDC5', c: '#D2432A' } },
  { id: 'cobalt_saffron', label: 'Kobalt & Safran', dark: { a: '#3B67FF', b: '#241B10', c: '#E7C447' }, light: { a: '#254CC9', b: '#C8B58E', c: '#A97912' } },
  { id: 'classic_amber', label: 'Klassischer Bernstein', dark: { a: '#F0B33A', b: '#2F2A22', c: '#A86B16' }, light: { a: '#B26B00', b: '#D4C7B0', c: '#8C5200' } },
  { id: 'jade_mono', label: 'Jade-Mono', dark: { a: '#42DCA3', b: '#123247', c: '#2A8A69' }, light: { a: '#138A61', b: '#A9C8D4', c: '#0F6E50' } },
  { id: 'cyan_mono', label: 'Cyan-Mono', dark: { a: '#55D6F2', b: '#18264D', c: '#2D94AA' }, light: { a: '#147E96', b: '#AEBCE6', c: '#0E6578' } },
  { id: 'violet_mono', label: 'Violett-Mono', dark: { a: '#B389FF', b: '#3A1729', c: '#7D5AC7' }, light: { a: '#6E45B8', b: '#D7B6C8', c: '#53308D' } },
];

function contrastInk(hex: string): '#101010' | '#ffffff' {
  const channels = [1, 3, 5].map(offset => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#101010' : '#ffffff';
}

export function applyTheme(mode: ThemeMode, paletteId: string): void {
  const palette = THEME_PALETTES.find(item => item.id === paletteId) ?? THEME_PALETTES[0];
  const colors = palette[mode];
  const root = document.documentElement;
  root.dataset.mode = mode;
  root.dataset.palette = palette.id;
  root.style.setProperty('--color-a', colors.a);
  root.style.setProperty('--color-b', colors.b);
  root.style.setProperty('--color-c', colors.c);
  root.style.setProperty('--accent-ink', palette.id === 'jade_mono' || palette.id === 'classic_amber' ? '#ffffff' : contrastInk(colors.a));
}

export function themeInitScript(): string {
  return `(function(){try{var palettes=${JSON.stringify(THEME_PALETTES)};` +
    `var m=localStorage.getItem(${JSON.stringify(THEME_MODE_KEY)});` +
    `var mode=(m==='dark'||m==='light')?m:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');` +
    `var pid=localStorage.getItem(${JSON.stringify(THEME_PALETTE_KEY)});` +
    `var p=null;for(var i=0;i<palettes.length;i++){if(palettes[i].id===pid)p=palettes[i];}` +
    `if(!p){for(var j=0;j<palettes.length;j++){if(palettes[j].id===${JSON.stringify(DEFAULT_PALETTE_ID)})p=palettes[j];}}` +
    `if(!p)p=palettes[0];` +
    `var c=p[mode];var root=document.documentElement;root.dataset.mode=mode;root.dataset.palette=p.id;` +
    `root.style.setProperty('--color-a',c.a);root.style.setProperty('--color-b',c.b);root.style.setProperty('--color-c',c.c);` +
    `var rgb=[1,3,5].map(function(o){var v=parseInt(c.a.slice(o,o+2),16)/255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);});` +
    `var lum=0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];` +
    `var ink=(lum+0.05)/0.05>=1.05/(lum+0.05)?'#101010':'#ffffff';` +
    `root.style.setProperty('--accent-ink',(p.id==='jade_mono'||p.id==='classic_amber')?'#ffffff':ink);` +
    `}catch(e){}})();`;
}

