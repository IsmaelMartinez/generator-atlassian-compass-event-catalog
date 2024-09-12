# Atlassian Compass EventCatalog Generator

This generator can be used to create services in Event Catalog from an Atlassian Compass file.

# Getting started

## Installation and configuration

_Make sure you are on the latest version of EventCatalog_.

1. Install the package

```sh
npm install -g @ismaelmartinez/generator-atlassian-compass-event-catalog
```

2. Configure your EventCatalog to use your generator

Edit your `eventcatalog.config.js` file and add the generator

```js
...
generators: [
    [
        "@ismaelmartinez/generator-atlassian-compass-event-catalog",
        // These are options to give your generator
        {
            path: ["path/to/your/compass/file"],
            compassUrl: "https://your.atlassian.compass.url",
            domain: { id: 'orders', name: 'Compass', version: '0.0.1' }, //Optional
            debug: false //Optional
        }
        // Repeat for each domain
    ]
]
...
```

If a domain is provided, the services will be added to it. If the domain does not exist, it will be created.

Domain and services support versioning.

[(See full event catalog example)](examples/eventcatalog.config.js)

3. Run the generate command

On your EventCatalog project, run the generate command:

```sh
npm run generate
```

4. See your new domains, services and messages, run

```sh
npm run dev
```

## Features

Currently, the generator only supports generating services from an Atlassian Compass file.

## Found a problem?

Raise a GitHub issue on this project, or contact us on [our Discord server](https://discord.gg/3rjaZMmrAm).

## License

See [LICENSE](LICENSE).

## Contributing
