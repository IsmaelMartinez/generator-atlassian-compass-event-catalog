# Contributing

We welcome contributions to this project. 

## Getting started

1. Fork the repository
1. Clone the repository

```sh
git clone git@github.com:ismaelmartinez/generator-compass-event-catalog.git
```

1. Install the dependencies

```sh
pnpm install
```
1. Run your tests

```sh
pnpm test
```

1. Link the project

Link the project so it can be used in your EventCatalog

```sh
npm link
```

1. Using the package in your EventCatalog

Navigate to your EventCatalog directory, then link the package.

```sh
npm link @ismaelmartinez/generator-atlassian-compass-event-catalog
```

1. Compile and watch your plugin

```sh
# Just build the plugin once
pnpm run build

# Watch changes (recommended for dev)
pnpm run build -- -- watch
```

1. Run the generator

In your EventCatalog directory run:

```sh
npm run generate
```

This will run your generator code and interact with your Catalog.

You can now add your custom code to your generator to test against your catalog.

You can use the [EventCatalog SDK](https://www.eventcatalog.dev/docs/sdk) to get utils to read, write and delete files in your Catalog easier.


