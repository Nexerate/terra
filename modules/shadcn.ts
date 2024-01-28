import {
    defineNuxtModule,
    addComponent,
    addComponentsDir,
    tryResolveModule,
  } from 'nuxt/kit';
  
  export interface ShadcnVueOptions {
    /**
     * Prefix for all the imported component
     */
    prefix: string;
  
    /**
     * Directory that the component lives in.
     * @default "~/components/ui"
     */
    componentDir: string;
  }
  
  export default defineNuxtModule<ShadcnVueOptions>({
    defaults: {
      prefix: 'Ui',
      componentDir: '~/components/ui',
    },
    meta: {
      name: 'ShadcnVue',
      configKey: 'shadcn',
      version: '0.0.1',
      compatibility: {
        nuxt: '^3.9.0',
        bridge: false,
      },
    },
    async setup({ componentDir, prefix }) {
      const isVeeValidateExist = await tryResolveModule('vee-validate');
  
      addComponentsDir(
        {
          path: componentDir,
          extensions: ['.vue'],
          prefix,
          pathPrefix: false,
        },
        {
          prepend: true,
        }
      );
  
      if (isVeeValidateExist !== undefined) {
        addComponent({
          filePath: 'vee-validate',
          export: 'Form',
          name: `${prefix}Form`,
          priority: 999,
        });
  
        addComponent({
          filePath: 'vee-validate',
          export: 'Field',
          name: `${prefix}FormField`,
          priority: 999,
        });
      }
  
      addComponent({
        filePath: 'radix-vue',
        export: 'PaginationRoot',
        name: `${prefix}Pagination`,
        priority: 999,
      });
  
      addComponent({
        filePath: 'radix-vue',
        export: 'PaginationList',
        name: `${prefix}PaginationList`,
        priority: 999,
      });
  
      addComponent({
        filePath: 'radix-vue',
        export: 'PaginationListItem',
        name: `${prefix}PaginationListItem`,
        priority: 999,
      });
    },
  });
  
  declare module '@nuxt/schema' {
    interface NuxtConfig {
      shadcn?: ShadcnVueOptions;
    }
    interface NuxtOptions {
      shadcn?: ShadcnVueOptions;
    }
  }