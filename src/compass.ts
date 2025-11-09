import yaml from 'js-yaml';
import fs from 'fs';

//Object generated from the compass.yml file
// reference in https://developer.atlassian.com/cloud/compass/config-as-code/structure-and-contents-of-a-compass-yml-file/

enum TypeId {
  APPLICATION = 'APPLICATION',
  SERVICE = 'SERVICE',
  CAPABILITY = 'CAPABILITY',
  CLOUD_RESOURCE = 'CLOUD_RESOURCE',
  DATA_PIPELINE = 'DATA_PIPELINE',
  LIBRARY = 'LIBRARY',
  MACHINE_LEARNING_MODEL = 'MACHINE_LEARNING_MODEL',
  OTHER = 'OTHER',
  UI_ELEMENT = 'UI_ELEMENT',
  WEBSITE = 'WEBSITE',
}

enum Lifecycle {
  PRERELEASE = 'Pre-release',
  ACTIVE = 'Active',
  DEPRECATED = 'Deprecated',
}

enum UrlType {
  CHAT_CHANNEL = 'CHAT_CHANNEL',
  DOCUMENT = 'DOCUMENT',
  DASHBOARD = 'DASHBOARD',
  ON_CALL = 'ON_CALL',
  PROJECT = 'PROJECT',
  REPOSITORY = 'REPOSITORY',
  OTHER_LINK = 'OTHER_LINK',
}

type Field = {
  tier?: 1 | 2 | 3 | 4;
  lifecycle: Lifecycle;
};

type Link = {
  type: UrlType;
  url: string;
  name?: string;
};

enum CustomFieldType {
  TEXT = 'text',
  BOOLEAN = 'boolean',
  NUMBER = 'number',
  USER = 'user',
  SINGLE_SELECT = 'single_select',
  MULTIPLE_SELECT = 'multi_select',
}

type CustomField = {
  type: CustomFieldType;
  name: string;
  value: string;
};

export type CompassConfig = {
  configVersion?: number;
  name: string;
  id?: string;
  description?: string;
  typeId?: TypeId;
  ownerId?: string;
  fields?: Field;
  links?: Link[];
  relationships?: {
    DEPENDS_ON?: string[];
  };
  customFields?: CustomField[];
  labels?: string[];
};

export function loadConfig(path: string): CompassConfig {
  return yaml.load(fs.readFileSync(path, 'utf8')) as CompassConfig;
}
