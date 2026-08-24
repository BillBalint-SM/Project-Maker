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
      canvas: 'oklch(12% 0.03 255)',
      canvasDeep: 'oklch(8% 0.028 255)',
      surface1: 'oklch(17% 0.038 255)',
      surface2: 'oklch(23% 0.045 252)',
      surface3: 'oklch(28% 0.05 248)',
      text: 'oklch(95% 0.012 235)',
      textMuted: 'oklch(70% 0.035 230)',
      border: 'oklch(31% 0.055 245)',
      electricBlue: 'oklch(78% 0.15 195)',
      cyan: 'oklch(84% 0.14 190)',
      magenta: 'oklch(74% 0.19 328)',
      yellow: 'oklch(86% 0.17 95)',
      danger: 'oklch(71% 0.19 28)',
      lightCanvas: 'oklch(98% 0.012 235)',
      lightSurface1: 'oklch(94% 0.02 235)',
      lightSurface2: 'oklch(89% 0.03 232)',
      lightSurface3: 'oklch(84% 0.038 232)',
      lightText: 'oklch(16% 0.035 255)',
      lightTextMuted: 'oklch(42% 0.045 245)',
      lightBorder: 'oklch(78% 0.04 235)',
      lightFocus: 'oklch(43% 0.19 275)',
      lightDanger: 'oklch(43% 0.19 28)',
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
          50: 'color-mix(in oklch, {projectMaker.lightSurface1} 70%, {projectMaker.lightCanvas})',
          100: '{projectMaker.lightCanvas}',
          200: '{projectMaker.lightSurface2}',
          300: '{projectMaker.lightSurface3}',
          400: 'color-mix(in oklch, {projectMaker.lightBorder} 70%, {projectMaker.lightTextMuted})',
          500: 'color-mix(in oklch, {projectMaker.lightBorder} 40%, {projectMaker.lightTextMuted})',
          600: 'color-mix(in oklch, {projectMaker.lightBorder} 20%, {projectMaker.lightTextMuted})',
          700: '{projectMaker.lightTextMuted}',
          800: 'color-mix(in oklch, {projectMaker.lightTextMuted} 68%, {projectMaker.lightText})',
          900: 'color-mix(in oklch, {projectMaker.lightTextMuted} 34%, {projectMaker.lightText})',
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
          invalidBorderColor: '{projectMaker.lightDanger}',
          color: '{projectMaker.lightText}',
          disabledColor: 'color-mix(in oklch, {projectMaker.lightTextMuted} 72%, {projectMaker.lightSurface1})',
          placeholderColor: '{projectMaker.lightTextMuted}',
          invalidPlaceholderColor: '{projectMaker.lightDanger}',
          floatLabelColor: '{projectMaker.lightTextMuted}',
          floatLabelFocusColor: '{projectMaker.lightFocus}',
          floatLabelActiveColor: '{projectMaker.lightTextMuted}',
          floatLabelInvalidColor: '{projectMaker.lightDanger}',
          iconColor: '{projectMaker.lightTextMuted}',
        },
        highlight: {
          background: 'color-mix(in srgb, {projectMaker.electricBlue} 18%, {projectMaker.lightSurface1})',
          focusBackground: 'color-mix(in srgb, {projectMaker.electricBlue} 28%, {projectMaker.lightSurface1})',
          color: '{projectMaker.lightText}',
          focusColor: '{projectMaker.lightText}',
        },
        text: {
          color: '{projectMaker.lightText}',
          hoverColor: '{projectMaker.lightText}',
          mutedColor: '{projectMaker.lightTextMuted}',
          hoverMutedColor: 'color-mix(in oklch, {projectMaker.lightTextMuted} 70%, {projectMaker.lightText})',
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
          100: 'color-mix(in oklch, {projectMaker.text} 88%, {projectMaker.textMuted})',
          200: 'color-mix(in oklch, {projectMaker.text} 62%, {projectMaker.textMuted})',
          300: '{projectMaker.textMuted}',
          400: 'color-mix(in oklch, {projectMaker.textMuted} 82%, {projectMaker.border})',
          500: 'color-mix(in oklch, {projectMaker.textMuted} 58%, {projectMaker.border})',
          600: 'color-mix(in oklch, {projectMaker.textMuted} 34%, {projectMaker.border})',
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
          focusBorderColor: '{projectMaker.yellow}',
          invalidBorderColor: '{projectMaker.danger}',
          color: '{projectMaker.text}',
          disabledColor: '{surface.500}',
          placeholderColor: '{projectMaker.textMuted}',
          invalidPlaceholderColor: '{projectMaker.danger}',
          floatLabelColor: '{projectMaker.textMuted}',
          floatLabelFocusColor: '{projectMaker.yellow}',
          floatLabelActiveColor: '{projectMaker.textMuted}',
          floatLabelInvalidColor: '{projectMaker.danger}',
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
          color: '{projectMaker.yellow}',
          width: '0.16rem',
          style: 'solid',
          offset: '0.12rem',
        },
      },
    },
  },
});
