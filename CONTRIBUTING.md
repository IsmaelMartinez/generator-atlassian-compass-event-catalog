# Contributing

We welcome contributions to this project.

## Getting started

1. Fork the repository

   Look at the [fork a repo](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) github documentation to learn how to fork a repository.

1. Clone the repository

   Once forked, clone the repository to your machine.

   ```sh
   git clone git@github.com:ismaelmartinez/generator-compass-event-catalog.git
   ```

1. Install the dependencies

   The project uses [pnpm](https://pnpm.io/) as the package manager.

   ```sh
   pnpm install
   ```

## Developing

It uses [vitest](https://vitest.dev/) for testing.

```sh
pnpm test
```

You can link the project to your EventCatalog to test your generator.

```sh
npm link
```

After linking, then you can navigate to your EventCatalog directory and link back the package.

```sh
npm link @ismaelmartinez/generator-atlassian-compass-event-catalog
```

Then, in the this generator project, you can run the build command to build the project.

```sh
pnpm run build
```

Finally, you can run the generate command in your EventCatalog project as you will do when using the package.

```sh
npm run generate
```

You should be ready to start developing with the generator. Open and [issue](https://github.com/IsmaelMartinez/generator-atlassian-compass-event-catalog/issues) if you find any problems.

EventCatalog uses [EventCatalog SDK](https://www.eventcatalog.dev/docs/sdk) to interact with the Catalog.

You can also explore the [get started building compass apps](https://developer.atlassian.com/cloud/compass/integrations/get-started-integrating-with-Compass/#get-started-building-compass-apps) to learn more about the Compass API. I haven't explore it yet.
