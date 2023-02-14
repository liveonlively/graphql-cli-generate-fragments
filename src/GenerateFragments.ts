import chalk from "chalk";
import * as fs from "fs-extra";
import { GraphQLConfig, GraphQLProjectConfig } from "graphql-config";
import { importSchema } from "graphql-import";
import { get, has, merge } from "lodash";
import * as path from "path";
import { Arguments } from "yargs";

import {
  graphql,
  DocumentNode,
  Kind,
  ObjectTypeDefinitionNode,
  OperationTypeDefinitionNode,
  GraphQLObjectType,
  GraphQLNamedType,
  GraphQLFieldMap,
  parse
} from "graphql";
import { GraphQLSchema } from "graphql/type/schema";
import {
  buildASTSchema,
  introspectionQuery,
  printSchema
} from "graphql/utilities";


// This will get loaded from external JSON
type Fragment = {
  name: string;
  fragment: string;
}
type ModelFragmentType = 'PublicListing' | 'Public' | 'AdminListing' | 'Admin'
type ModelConfig = {
  [k in ModelFragmentType]: string[];
}

function flatten<T>(arr: Array<T[] | undefined>): T[] {
  const res: T[] = [];
  arr.forEach((sub?: T[]) => {
    if (!sub) return;
    sub.forEach((v: T) => {
      if (!v) return;
      res.push(v);
    });
  })
  return res;
}


export class GenerateFragments {
  private config: GraphQLConfig;
  private fragmentsExtensionConfig:
    | { "generate-fragments": string }
    | undefined;
  private projectName: string;
  private project: GraphQLProjectConfig;

  constructor(private context: any, private argv: Arguments) {}

  public async handle() {
    this.config = await this.context.getConfig();

    // Get projects
    const projects: {
      [name: string]: GraphQLProjectConfig;
    } = this.getProjectConfig();

    // Process each project
    for (const projectName of Object.keys(projects)) {
      const project: GraphQLProjectConfig = projects[projectName];

      this.setCurrentProject(project, projectName);
      // if (this.argv.bundle) {
      //   this.bundle()
      // }
      // if (this.argv.graphql) {
      this.fragments();
      // }
      this.save();
    }
  }

  private setCurrentProject(
    project: GraphQLProjectConfig,
    projectName: string
  ): void {
    this.project = project;
    this.projectName = projectName;
    this.fragmentsExtensionConfig = undefined;
  }

  private fragments() {
    let fragmentsExtensionConfig:
      | { "generate-fragments": { output: string; generator: string, modelConfigs?: string } }
      | undefined;

    if (
      this.argv.project ||
      (!this.argv.project &&
        (has(this.project.config, "extensions.generate-fragments") ||
          has(this.project.config, "extensions.fragments")))
    ) {
      this.context.spinner.start(
        `Generating fragments for project ${this.projectDisplayName()}...`
      );
      fragmentsExtensionConfig = this.processFragments(
        this.fragmentsExtensionConfig
          ? this.fragmentsExtensionConfig["generate-fragments"]
          : undefined
      );
      merge(this.project.extensions, fragmentsExtensionConfig);

      this.context.spinner.succeed(
        `Fragments for project ${this.projectDisplayName()} written to ${chalk.green(
          fragmentsExtensionConfig["generate-fragments"].output
        )}`
      );
    } else if (this.argv.verbose) {
      this.context.spinner.info(
        `Generate Fragments not configured for project ${this.projectDisplayName()}. Skipping`
      );
    }
  }

  private save() {
    if (this.argv.save) {
      const configFile = path.basename(this.config.configPath);
      this.context.spinner.start(
        `Saving configuration for project ${this.projectDisplayName()} to ${chalk.green(
          configFile
        )}...`
      );
      this.saveConfig();
      this.context.spinner.succeed(
        `Configuration for project ${this.projectDisplayName()} saved to ${chalk.green(
          configFile
        )}`
      );
    }
  }

  private getProjectConfig(): { [name: string]: GraphQLProjectConfig } {
    let projects: { [name: string]: GraphQLProjectConfig } | undefined;
    if (this.argv.project) {
      if (Array.isArray(this.argv.project)) {
        projects = {};
        this.argv.project.map((p: string) =>
          merge(projects, { [p]: this.config.getProjectConfig(p) })
        );
      } else {
        // Single project mode
        projects = {
          [this.argv.project]: this.config.getProjectConfig(this.argv.project)
        };
      }
    } else {
      // Process all projects
      projects = this.config.getProjects();
    }

    if (!projects) {
      throw new Error("No projects defined in config file");
    }

    return projects;
  }

  private processFragments(
    schemaPath: string | undefined
  ): { "generate-fragments": { output: string; generator: string, modelConfigs?: string } } {
    const generator: string = this.determineGenerator();
    let extension = "js";
    if (generator === "graphql") {
      extension = "graphql";
    }
    if (generator === "multi-file-graphql") {
      extension = "gql";
    }
    let outputPath: string = this.determineFragmentsOutputPath(extension);
    const schema: string = this.determineInputSchema(schemaPath);
    let modelConfigs: Record<string, ModelConfig> | undefined = undefined;
    if (has(this.project.config, "extensions.generate-fragments.modelConfigs")) {
      const configFilePath = get(
        this.project.config,
        "extensions.generate-fragments.modelConfigs"
      );
      modelConfigs = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
      if (!modelConfigs) {
        throw new Error("Unable to parse modelConfigs file " + configFilePath);
      }
    }

    const schemaContents: string = importSchema(schema); //******************************************* */
    const fragments: Array<Fragment> = this.makeFragments(schemaContents, generator, modelConfigs);

    if (fragments.length !== 0 && fragments[0].name !== "*") {
      const basePath = outputPath.split('/').slice(0, -1).join('/')
      fragments.map(({ name, fragment }) => {
        fs.writeFileSync(`${basePath}/${name}.${extension}`, fragment, { flag: "w" });
      });
      outputPath = outputPath.split('/').slice(0, -1).join('/')
    } else {
      fs.writeFileSync(outputPath, fragments[0].fragment, { flag: "w" });
    }

    return {
      "generate-fragments": { output: outputPath, generator: generator }
    };
  }

  /**
   *
   */

  private indentedLine(level) {
    let line = "\n";
    for (let i = 0; i < level; i++) {
      line += "  ";
    }
    return line;
  }

  private fragmentType = {
    DEFAULT: "",
    NO_RELATIONS: "NoNesting",
    DEEP: "DeepNesting"
  };

  private makeFragments(schemaContents: string, generator: string, modelConfigs?: Record<string, ModelConfig>): Array<Fragment> {
    const document: DocumentNode = parse(schemaContents, { noLocation: true });
    const ast: GraphQLSchema = buildASTSchema(document);

    const typeNames = Object.keys(ast.getTypeMap())
      .filter(
        typeName =>
          ast.getType(typeName) !== undefined
      )
      .filter(
        typeName =>
          (ast.getType(typeName) as GraphQLNamedType).constructor.name === "GraphQLObjectType"
      )
      .filter(typeName => !typeName.startsWith("__"))
      .filter(typeName => typeName !== (ast.getQueryType() as GraphQLObjectType).name)
      .filter(
        typeName =>
          ast.getMutationType()
            ? typeName !== (ast.getMutationType() as GraphQLObjectType)!.name
            : true
      )
      .filter(
        typeName =>
          ast.getSubscriptionType()
            ? typeName !== (ast.getSubscriptionType() as GraphQLObjectType)!.name
            : true
      )
      .sort(
        (a, b) =>
          (ast.getType(a) as GraphQLNamedType).constructor.name < (ast.getType(b) as GraphQLNamedType).constructor.name
            ? -1
            : 1
      );

    // console.log(typeNames)

    const standardFragments = typeNames.map(typeName => {
      const type: any = ast.getType(typeName);
      const { name } = type;

      const fields = this.generateFragments(type, ast);
      if(fields.length === 0) return null
      return {
        name,
        fragment: `fragment ${name} on ${name} {
  ${fields.join(this.indentedLine(1))}
}
`
      };
    }).filter(frag => frag != null);

    const noRelationsFragments = typeNames.map(typeName => {
      const type: any = ast.getType(typeName);
      const { name } = type;

      const fields = this.generateFragments(type, ast, this.fragmentType.NO_RELATIONS);
      if(fields.length === 0) return null

      return {
        name,
        fragment: `fragment ${name}${
          this.fragmentType.NO_RELATIONS
        } on ${name} {
  ${fields.join(this.indentedLine(1))}
}
`
      };
    }).filter(frag => frag != null);
    const modelNames = Object.keys(modelConfigs);
    const deepFragments: Fragment[] = flatten<Fragment>(typeNames.map((typeName: string): Fragment[] => {
      const type: any = ast.getType(typeName);
      const { name } = type;
      let fragment = '';

      const fields = this.generateFragments(type, ast, this.fragmentType.DEEP);
      if (fields.length === 0) return null

      if (modelConfigs && modelConfigs[name]) {
        return Object.keys(modelConfigs[name]).map((suffix) => {
          const allowlist: string[] = modelConfigs[name][suffix];
          const spreadFragments = [];
          if (suffix === 'Admin') {
            spreadFragments.push(`...${name}AdminListing`);
          }
          if (suffix === 'AdminListing') {
            spreadFragments.push(`...${name}PublicListing`);
          }
          if (suffix === 'Public') {
            spreadFragments.push(`...${name}PublicListing`);
          }
          if (spreadFragments.length) {
            spreadFragments.push('');  // Adds an extra newline at the end which we want
          }
          fragment = `fragment ${name}${suffix} on ${name} {
  ${spreadFragments.join(this.indentedLine(1))}${fields.filter((f: string) => allowlist.indexOf(f.split(' ')[0]) !== -1).join(this.indentedLine(1))}
}`;
          if (suffix.indexOf('Admin') === -1) {
            for (let i = 0; i < modelNames.length; i++) {
              const modelName = modelNames[i];
              fragment = fragment.replace(RegExp(`\\.\\.\\.${modelName}DeepNesting`, 'g'), `...${modelName}PublicListing`);
            }
            fragment = fragment.replace(/DeepNesting/g, 'Full');
          } else {
            for (let i = 0; i < modelNames.length; i++) {
              const modelName = modelNames[i];
              fragment = fragment.replace(RegExp(`\\.\\.\\.${modelName}DeepNesting`, 'g'), `...${modelName}AdminListing`);
            }
            fragment = fragment.replace(/DeepNesting/g, 'Full');
          }
          return {
            name: `${name}${suffix}`,
            fragment,
          };
        });
      } else {
        fragment = `fragment ${name}Full on ${name} {
  ${fields.join(this.indentedLine(1))}
}`;
        for (let i = 0; i < modelNames.length; i++) {
          const modelName = modelNames[i];
          fragment = fragment.replace(RegExp(`\\.\\.\\.${modelName}DeepNesting`, 'g'), `...${modelName}PublicListing`);
        }
        fragment = fragment.replace(/DeepNesting/g, 'Full');
        return [{
          name: `${name}Full`,
          fragment,
        }];
      }
    }));


    if (generator === "js") {
      return [{
        name: '*',
        fragment: `// THIS FILE HAS BEEN AUTO-GENERATED BY "graphql-cli-generate-fragments"
// DO NOT EDIT THIS FILE DIRECTLY
${standardFragments
            .map(
              ({ name, fragment }) => `
export const ${name}Fragment = \`${fragment}\`
`
            )
            .join("")}
${noRelationsFragments
            .map(
              ({ name, fragment }) => `
export const ${name}${this.fragmentType.NO_RELATIONS}Fragment = \`${fragment}\`
`
            )
            .join("")}
${deepFragments
            .map(
              ({ name, fragment }) => `
export const ${name}${this.fragmentType.DEEP}Fragment = \`${fragment}\`
`
            )
            .join("")}
`}];
    }
    if (generator === "multi-file-graphql") {
      return deepFragments;
    }
    return [{
      name: '*',
      fragment: `# THIS FILE HAS BEEN AUTO-GENERATED BY "graphql-cli-generate-fragments"
# DO NOT EDIT THIS FILE DIRECTLY

# Standard Fragments
# Nested fragments will spread one layer deep

${standardFragments
          .map(
            ({ name, fragment }) => `
${fragment}`
          )
          .join("")}

# No Relational objects
# No nested fragments

${noRelationsFragments
          .map(
            ({ name, fragment }) => `
${fragment}`
          )
          .join("")}

# Deeply nested Fragments
# Will include n nested fragments
# If there is a recursive relation you will receive a
# "Cannot spread fragment within itself" error when using

${deepFragments
          .map(
            ({ name, fragment }) => `
${fragment}`
          )
          .join("")}
`}];
  }

  private generateFragments(type: any, ast: GraphQLSchema, fragmentType = this.fragmentType.DEFAULT) {
    const fields: GraphQLFieldMap<any, any> = type.getFields();
    const fragmentFields = Object.keys(fields)
      .map(field => {
        return this.printField(field, fields[field], ast, fragmentType);
      })
      // Some fields should not be printed, ie. fields with relations.
      // Remove those from the output by returning null from printField.
      .filter(field => field != null);
    return fragmentFields;
  }

  private printField(
    fieldName,
    field,
    ast: GraphQLSchema,
    fragmentType,
    indent = 1
  ) {
    let constructorName =
      field.type.constructor.name && field.type.constructor.name;
    if (constructorName === "Object")
      constructorName =
        (field.type.name &&
          (ast.getType(field.type.name.value) as GraphQLNamedType).constructor.name) ||
        null;

    if (constructorName === "GraphQLList") {
      field =
        (field.astNode.type.type.type && field.astNode.type.type.type) ||
        ((field.astNode.type.type && field.astNode.type.type) || null);

      if (field === null) {
        throw new Error(`Schema malformed - list`);
      }
      constructorName = (ast.getType(field.name.value) as GraphQLNamedType).constructor.name;
    }

    if (constructorName === "GraphQLNonNull" || field.kind === "NonNullType") {
      field = (field.astNode.type && field.astNode.type) || field.type;
      constructorName =
        (field.type.name &&
          (ast.getType(field.type.name.value) as GraphQLNamedType).constructor.name) ||
        null;
      if (constructorName === null) {
        field = (field.type && field.type) || null;
        constructorName =
          (field.type.name &&
            (ast.getType(field.type.name.value) as GraphQLNamedType).constructor.name) ||
          null;
      }
    }

    if (
      constructorName === "GraphQLScalarType" ||
      constructorName === "GraphQLEnumType"
    ) {
      return fieldName;
    }

    if (constructorName === "GraphQLObjectType") {
      if (fragmentType === this.fragmentType.NO_RELATIONS) return null;
      let typeName = null;
      // if(field.name !== undefined)
      typeName =
        (field.name && field.name.value) ||
        ((field.type.name.value && field.type.name.value) || field.type.name);

      return (
        fieldName +
        " {" +
        this.indentedLine(indent + 1) +
        "..." +
        `${(fragmentType === this.fragmentType.DEEP &&
          typeName + this.fragmentType.DEEP) ||
          (fragmentType === this.fragmentType.DEFAULT &&
          typeName + this.fragmentType.NO_RELATIONS) ||
          typeName + this.fragmentType.DEFAULT}` +
        this.indentedLine(indent) +
        "}"
      );
    }

    return null;
  }

  /****************************** */

  private saveConfig() {
    if (has(this.project.config, "extensions.fragments")) {
      delete this.project.config.extensions!.fragments;
    }
    this.config.saveConfig(this.project.config, this.projectName);
  }

  /**
   * Determine input schema path for binding. It uses the resulting schema from bundling (if available),
   * then looks at bundle extension (in case bundling ran before), then takes the project schemaPath.
   * Also checks if the file exists, otherwise it throws and error.
   *
   * @param {(string | undefined)} schemaPath Schema path from bundling
   * @returns {string} Input schema path to be used for binding generation.
   */
  private determineInputSchema(schemaPath: string | undefined): string {
    const bundleDefined = has(
      this.project.config,
      "extensions.prepare-bundle.output"
    );
    const oldBundleDefined = has(
      this.project.config,
      "extensions.bundle.output"
    );
    // schemaPath is only set when bundle ran
    if (!schemaPath) {
      if (bundleDefined) {
        // Otherwise, use bundle output schema if defined
        schemaPath = get(
          this.project.config,
          "extensions.prepare-bundle.output"
        );
      } else if (oldBundleDefined) {
        schemaPath = get(this.project.config, "extensions.bundle.output");
      } else if (this.project.schemaPath) {
        // Otherwise, use project schemaPath
        schemaPath = this.project.schemaPath;
      } else {
        throw new Error(`Input schema cannot be determined.`);
      }
    }

    console.log(schemaPath)


    const getExtension = str => str.split('.').pop()

    if(getExtension(schemaPath) !== 'graphql' && getExtension(schemaPath) !== 'gql'){
      throw new Error(`Schema has an extension of '.${getExtension(schemaPath)}'
- Only '.graphql' schema's are supported by 'generate-fragments'.`)
    }

    if (fs.existsSync(schemaPath!)) {
      return schemaPath!;
    } else {
      throw new Error(
        `Schema '${schemaPath!}' not found.${
          bundleDefined ? " Did you run bundle/get-schema first?" : ""
        }`
      );
    }
  }

  /**
   * Determine input schema path for bundling.
   *
   * @returns {string} Input schema path for bundling
   */
  private determineSchemaPath(): string {
    if (this.project.schemaPath) {
      return this.project.schemaPath;
    }
    throw new Error(
      `No schemaPath defined for project '${this.projectName}' in config file.`
    );
  }

  /**
   * Determine generator. Provided generator takes precedence over value from config
   *
   * @param {string} generator Command line parameter for generator
   * @returns {string} Generator to be used
   */
  private determineGenerator(): string {
    if (this.argv.generator) {
      return this.argv.generator;
    }
    if (has(this.project.config, "extensions.generate-fragments.generator")) {
      return get(
        this.project.config,
        "extensions.generate-fragments.generator"
      );
    }
    throw new Error(
      "Generator cannot be determined. No existing configuration found and no generator parameter specified."
    );
  }

  /**
   * Determine output path for fragments. Provided path takes precedence over value from config
   *
   * @param {string} extension File extension for output file
   * @returns Output path
   */
  private determineFragmentsOutputPath(extension: string) {
    let outputPath: string;
    if (this.argv.output) {
      outputPath = path.join(
        this.argv.output,
        `${this.projectName}.fragments.${extension}`
      );
    } else if (
      has(this.project.config, `extensions.generate-fragments.output`)
    ) {
      outputPath = get(
        this.project.config,
        `extensions.generate-fragments.output`
      );
    } else {
      throw new Error(
        "Output path cannot be determined. No existing configuration found and no output parameter specified."
      );
    }

    fs.ensureDirSync(path.dirname(outputPath));
    return outputPath;
  }

  private projectDisplayName = () => chalk.green(this.projectName);
}


