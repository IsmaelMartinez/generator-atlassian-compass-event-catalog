# Contributing

We welcome contributions to this project.

## Getting started

1. Fork the repository

   Look at the [fork a repo](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) github documentation to learn how to fork a repository.

1. Clone the repository

   Once forked, clone the repository to your machine.

   ```sh
   git clone git@github.com:<your-username>/generator-atlassian-compass-event-catalog.git
   ```

1. Install the dependencies

   The project uses [pnpm](https://pnpm.io/) as the package manager.

   ```sh
   pnpm install
   ```

## Developing

It uses [vitest](https://vitest.dev/) for testing, [eslint](https://eslint.org/) for linting, and [prettier](https://prettier.io/) for formatting.

```sh
pnpm run test              # run tests in watch mode
pnpm run test -- run       # single test run (no watch)
pnpm run test:coverage     # run tests with coverage report
pnpm run lint              # check for lint errors
pnpm run lint:fix          # auto-fix lint errors
pnpm run format:diff       # check formatting
pnpm run format            # auto-format files
pnpm run build             # build with tsup (CJS + ESM + .d.ts)
```

You can link the project to your EventCatalog to test your generator.

```sh
npm link
```

After linking, then you can navigate to your EventCatalog directory and link back the package.

```sh
npm link @ismaelmartinez/generator-atlassian-compass-event-catalog
```

Then, in this generator project, you can run the build command to build the project.

```sh
pnpm run build
```

Finally, you can run the generate command in your EventCatalog project as you will do when using the package.

```sh
npm run generate
```

You should be ready to start developing with the generator. Open an [issue](https://github.com/IsmaelMartinez/generator-atlassian-compass-event-catalog/issues) if you find any problems.

EventCatalog uses the [EventCatalog SDK](https://www.eventcatalog.dev/docs/sdk) to interact with the Catalog. The generator also integrates with the [Compass GraphQL API](https://developer.atlassian.com/cloud/compass/integrations/get-started-integrating-with-Compass/) for API mode, fetching components, teams, and metadata directly from Compass.
