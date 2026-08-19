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

// Keep this list aligned with the PrimeNG modules imported by the application.
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
      electricBlue: '#0088ff',
      cyan: '#00e5ff',
      deepNavy: '#071426',
      steelGray: '#8ca0b3',
    },
  },
  semantic: {
    primary: {
      50: 'color-mix(in srgb, {projectMaker.electricBlue} 8%, white)',
      100: 'color-mix(in srgb, {projectMaker.electricBlue} 16%, white)',
      200: 'color-mix(in srgb, {projectMaker.electricBlue} 28%, white)',
      300: 'color-mix(in srgb, {projectMaker.electricBlue} 48%, white)',
      400: 'color-mix(in srgb, {projectMaker.electricBlue} 72%, {projectMaker.cyan})',
      500: '{projectMaker.electricBlue}',
      600: 'color-mix(in srgb, {projectMaker.electricBlue} 88%, {projectMaker.deepNavy})',
      700: 'color-mix(in srgb, {projectMaker.electricBlue} 72%, {projectMaker.deepNavy})',
      800: 'color-mix(in srgb, {projectMaker.electricBlue} 52%, {projectMaker.deepNavy})',
      900: 'color-mix(in srgb, {projectMaker.electricBlue} 28%, {projectMaker.deepNavy})',
      950: '{projectMaker.deepNavy}',
      color: '{primary.500}',
      contrastColor: '{projectMaker.deepNavy}',
      hoverColor: '{primary.600}',
      activeColor: '{primary.700}',
    },
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: 'color-mix(in srgb, {projectMaker.steelGray} 8%, white)',
          100: 'color-mix(in srgb, {projectMaker.steelGray} 14%, white)',
          200: 'color-mix(in srgb, {projectMaker.steelGray} 24%, white)',
          300: 'color-mix(in srgb, {projectMaker.steelGray} 42%, white)',
          400: '{projectMaker.steelGray}',
          500: 'color-mix(in srgb, {projectMaker.steelGray} 82%, {projectMaker.deepNavy})',
          600: 'color-mix(in srgb, {projectMaker.steelGray} 64%, {projectMaker.deepNavy})',
          700: 'color-mix(in srgb, {projectMaker.steelGray} 44%, {projectMaker.deepNavy})',
          800: 'color-mix(in srgb, {projectMaker.steelGray} 22%, {projectMaker.deepNavy})',
          900: 'color-mix(in srgb, {projectMaker.steelGray} 10%, {projectMaker.deepNavy})',
          950: '{projectMaker.deepNavy}',
        },
      },
    },
    text: {
      color: '{projectMaker.deepNavy}',
      hoverColor: '{primary.700}',
      mutedColor: '{projectMaker.steelGray}',
      hoverMutedColor: '{surface.600}',
    },
    focusRing: {
      color: '{projectMaker.cyan}',
    },
  },
});
