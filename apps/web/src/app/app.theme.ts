import { definePreset } from '@primeuix/themes';
import AuraBase from '@primeuix/themes/aura/base';
import AuraButton from '@primeuix/themes/aura/button';
import AuraCard from '@primeuix/themes/aura/card';
import AuraConfirmDialog from '@primeuix/themes/aura/confirmdialog';
import AuraDatePicker from '@primeuix/themes/aura/datepicker';
import AuraInputText from '@primeuix/themes/aura/inputtext';
import AuraMessage from '@primeuix/themes/aura/message';
import AuraProgressSpinner from '@primeuix/themes/aura/progressspinner';
import AuraSelect from '@primeuix/themes/aura/select';
import AuraTag from '@primeuix/themes/aura/tag';
import AuraTextarea from '@primeuix/themes/aura/textarea';

// Keep this list aligned with the Aura component-theme packages used by the application.
// PrimeNG's Overlay supplies its own structural CSS and has no Aura component preset.
// Importing the complete Aura preset makes every component theme eager.
const ProjectMakerAura = {
  ...AuraBase,
  components: {
    button: AuraButton,
    card: AuraCard,
    confirmdialog: AuraConfirmDialog,
    datepicker: AuraDatePicker,
    inputtext: AuraInputText,
    message: AuraMessage,
    progressspinner: AuraProgressSpinner,
    select: AuraSelect,
    tag: AuraTag,
    textarea: AuraTextarea,
  },
};

export const ProjectMakerPreset = definePreset(ProjectMakerAura, {
  extend: {
    projectMaker: {
      canvas: '#050611',
      canvasDeep: '#02030a',
      surface1: '#0b1021',
      surface2: '#11182d',
      surface3: '#19213b',
      text: '#f4f6ff',
      textMuted: '#a8b3cf',
      border: '#273253',
      electricBlue: '#31b7ff',
      cyan: '#52ecff',
      magenta: '#f044ff',
      yellow: '#ffe45c',
      lightCanvas: '#f4f6fb',
      lightSurface1: '#fbfcff',
      lightSurface2: '#e9eef7',
      lightSurface3: '#d7e0ee',
      lightText: '#11182b',
      lightTextMuted: '#526078',
      lightBorder: '#b9c6d9',
      lightFocus: '#006da8',
    },
  },
  semantic: {
    primary: {
      50: 'color-mix(in srgb, {projectMaker.electricBlue} 10%, {projectMaker.text})',
      100: 'color-mix(in srgb, {projectMaker.electricBlue} 20%, {projectMaker.text})',
      200: 'color-mix(in srgb, {projectMaker.electricBlue} 38%, {projectMaker.text})',
      300: 'color-mix(in srgb, {projectMaker.electricBlue} 62%, {projectMaker.cyan})',
      400: 'color-mix(in srgb, {projectMaker.electricBlue} 82%, {projectMaker.cyan})',
      500: '{projectMaker.electricBlue}',
      600: 'color-mix(in srgb, {projectMaker.electricBlue} 84%, {projectMaker.canvasDeep})',
      700: 'color-mix(in srgb, {projectMaker.electricBlue} 66%, {projectMaker.canvasDeep})',
      800: 'color-mix(in srgb, {projectMaker.electricBlue} 46%, {projectMaker.canvasDeep})',
      900: 'color-mix(in srgb, {projectMaker.electricBlue} 28%, {projectMaker.canvasDeep})',
      950: 'color-mix(in srgb, {projectMaker.electricBlue} 16%, {projectMaker.canvasDeep})',
      color: '{primary.500}',
      contrastColor: '{projectMaker.canvasDeep}',
      hoverColor: '{primary.400}',
      activeColor: '{primary.300}',
    },
    colorScheme: {
      light: {
        surface: {
          0: '{projectMaker.lightSurface1}',
          50: '#f8faff',
          100: '{projectMaker.lightCanvas}',
          200: '{projectMaker.lightSurface2}',
          300: '{projectMaker.lightSurface3}',
          400: '#aab7ca',
          500: '#7c8aa3',
          600: '#65728a',
          700: '{projectMaker.lightTextMuted}',
          800: '#303d55',
          900: '#202b40',
          950: '{projectMaker.lightText}',
        },
        content: {
          background: '{projectMaker.lightSurface1}',
          hoverBackground: '{projectMaker.lightSurface2}',
          borderColor: '{projectMaker.lightBorder}',
          color: '{projectMaker.lightText}',
          hoverColor: '{projectMaker.lightText}',
        },
        formField: {
          background: '{projectMaker.lightSurface1}',
          disabledBackground: '{projectMaker.lightSurface2}',
          filledBackground: '{projectMaker.lightCanvas}',
          filledHoverBackground: '{projectMaker.lightSurface2}',
          filledFocusBackground: '{projectMaker.lightSurface1}',
          borderColor: '{projectMaker.lightBorder}',
          hoverBorderColor: 'color-mix(in srgb, {projectMaker.electricBlue} 42%, {projectMaker.lightBorder})',
          focusBorderColor: '{projectMaker.lightFocus}',
          invalidBorderColor: '{red.500}',
          color: '{projectMaker.lightText}',
          disabledColor: '#7c899f',
          placeholderColor: '{projectMaker.lightTextMuted}',
          invalidPlaceholderColor: '{red.600}',
          floatLabelColor: '{projectMaker.lightTextMuted}',
          floatLabelFocusColor: '{projectMaker.lightFocus}',
          floatLabelActiveColor: '{projectMaker.lightTextMuted}',
          floatLabelInvalidColor: '{red.600}',
          iconColor: '{projectMaker.lightTextMuted}',
        },
        highlight: {
          background: 'color-mix(in srgb, {projectMaker.electricBlue} 18%, {projectMaker.lightSurface1})',
          focusBackground: 'color-mix(in srgb, {projectMaker.electricBlue} 28%, {projectMaker.lightSurface1})',
          color: '#003b61',
          focusColor: '#002b49',
        },
        text: {
          color: '{projectMaker.lightText}',
          hoverColor: '#071226',
          mutedColor: '{projectMaker.lightTextMuted}',
          hoverMutedColor: '#35425a',
        },
        focusRing: {
          color: '{projectMaker.lightFocus}',
          width: '0.16rem',
          style: 'solid',
          offset: '0.12rem',
        },
      },
      dark: {
        surface: {
          0: '{projectMaker.text}',
          50: '{projectMaker.text}',
          100: '#e4e9f6',
          200: '#c7d0e5',
          300: '{projectMaker.textMuted}',
          400: '#8491b1',
          500: '#637091',
          600: '#46516f',
          700: '{projectMaker.border}',
          800: '{projectMaker.surface3}',
          900: '{projectMaker.surface1}',
          950: '{projectMaker.canvas}',
        },
        content: {
          background: '{projectMaker.surface1}',
          hoverBackground: '{projectMaker.surface2}',
          borderColor: '{projectMaker.border}',
          color: '{projectMaker.text}',
          hoverColor: '{projectMaker.cyan}',
        },
        formField: {
          background: '{projectMaker.surface2}',
          disabledBackground: '{projectMaker.surface1}',
          filledBackground: '{projectMaker.surface3}',
          filledHoverBackground: '{projectMaker.surface3}',
          filledFocusBackground: '{projectMaker.surface2}',
          borderColor: '{projectMaker.border}',
          hoverBorderColor: '{projectMaker.cyan}',
          focusBorderColor: '{projectMaker.cyan}',
          invalidBorderColor: '{red.300}',
          color: '{projectMaker.text}',
          disabledColor: '{surface.500}',
          placeholderColor: '{projectMaker.textMuted}',
          invalidPlaceholderColor: '{red.300}',
          floatLabelColor: '{projectMaker.textMuted}',
          floatLabelFocusColor: '{projectMaker.cyan}',
          floatLabelActiveColor: '{projectMaker.textMuted}',
          floatLabelInvalidColor: '{red.300}',
          iconColor: '{projectMaker.textMuted}',
        },
        highlight: {
          background: 'color-mix(in srgb, {projectMaker.electricBlue} 18%, {projectMaker.surface1})',
          focusBackground: 'color-mix(in srgb, {projectMaker.electricBlue} 28%, {projectMaker.surface2})',
          color: '{projectMaker.text}',
          focusColor: '{projectMaker.text}',
        },
        text: {
          color: '{projectMaker.text}',
          hoverColor: '{projectMaker.cyan}',
          mutedColor: '{projectMaker.textMuted}',
          hoverMutedColor: '{surface.200}',
        },
        focusRing: {
          color: '{projectMaker.cyan}',
          width: '0.16rem',
          style: 'solid',
          offset: '0.12rem',
        },
      },
    },
  },
});
