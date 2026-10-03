import { createTheme } from '@mantine/core'

/** Shared baseline; applications may extend it with their own provider concerns. */
export const billLmTheme = createTheme({
  primaryColor: 'violet',
  components: {
    Button: {
      defaultProps: {
        loaderProps: { type: 'dots' },
      },
    },
  },
})
