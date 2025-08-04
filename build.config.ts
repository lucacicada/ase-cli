import { defineBuildConfig } from 'unbuild'
import { dependencies } from './package.json' with { type: 'json' }

export default defineBuildConfig({
  externals: Object.keys(dependencies),

  rollup: {
    inlineDependencies: true,
  },
})
