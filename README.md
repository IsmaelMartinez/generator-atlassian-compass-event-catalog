# Atlassian Compass EventCatalog Generator

This generator can be used to create services in Event Catalog from an [Atlassian Compass file].

# Getting started

## Installation and configuration

_Make sure you are on the latest version of EventCatalog_.

1. Install the package

   ```sh
   npm install @ismaelmartinez/generator-atlassian-compass-event-catalog
   ```

1. Configure your EventCatalog to use your generator

   Edit your `eventcatalog.config.js` file and add the generator

   ```js
   ...
   generators: [
       [
           "@ismaelmartinez/generator-atlassian-compass-event-catalog",
           // These are options to give your generator
           {
               services: [
                   {
                       path: ["path/to/your/compass/file"],
                       version: "1.0.0" //Optional (defaults to 0.0.0)
                       id: "your-service-id" //Optional (defaults to the `name` in the compass file)
                   }, // Repeat for each service
               ],
               compassUrl: "https://your.atlassian.compass.url",
               domain: { id: 'orders', name: 'Compass', version: '1.0.0' }, //Optional
               debug: false //Optional
           }
           // Repeat for each domain
       ]
   ]
   ...
   ```

   [Example configuration file](examples/eventcatalog.config.js)

   NOTE: If a domain is provided, the services will be added to it. If the domain does not exist, it will be created.

1. Generate your services

   On your EventCatalog project, run the generate command:

   ```sh
   npm run generate
   ```

1. And explore your services in your catalog:

   ```sh
   npm run dev
   ```

## Features

Currently, the generator only supports generating services from an [Atlassian Compass file].

By design, the links with name 'null' are ignored. This is to allow having the links to EventCatalog in the Compass file without having to worry to show the link in the EventCatalog Service page.

## Found a problem?

Raise a GitHub issue on this project, or contact us on [our Discord server](https://discord.gg/3rjaZMmrAm).

## License

See [LICENSE](LICENSE).

## Contributing

See the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information.

[Atlassian Compass file]: https://developer.atlassian.com/cloud/compass/config-as-code/structure-and-contents-of-a-compass-yml-file/
