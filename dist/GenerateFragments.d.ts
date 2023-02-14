/// <reference types="yargs" />
import { Arguments } from "yargs";
export declare class GenerateFragments {
    private context;
    private argv;
    private config;
    private fragmentsExtensionConfig;
    private projectName;
    private project;
    constructor(context: any, argv: Arguments);
    handle(): Promise<void>;
    private setCurrentProject(project, projectName);
    private fragments();
    private save();
    private getProjectConfig();
    private processFragments(schemaPath);
    /**
     *
     */
    private indentedLine(level);
    private fragmentType;
    private makeFragments(schemaContents, generator, modelConfigs?);
    private generateFragments(type, ast, fragmentType?);
    private printField(fieldName, field, ast, fragmentType, indent?);
    /****************************** */
    private saveConfig();
    /**
     * Determine input schema path for binding. It uses the resulting schema from bundling (if available),
     * then looks at bundle extension (in case bundling ran before), then takes the project schemaPath.
     * Also checks if the file exists, otherwise it throws and error.
     *
     * @param {(string | undefined)} schemaPath Schema path from bundling
     * @returns {string} Input schema path to be used for binding generation.
     */
    private determineInputSchema(schemaPath);
    /**
     * Determine input schema path for bundling.
     *
     * @returns {string} Input schema path for bundling
     */
    private determineSchemaPath();
    /**
     * Determine generator. Provided generator takes precedence over value from config
     *
     * @param {string} generator Command line parameter for generator
     * @returns {string} Generator to be used
     */
    private determineGenerator();
    /**
     * Determine output path for fragments. Provided path takes precedence over value from config
     *
     * @param {string} extension File extension for output file
     * @returns Output path
     */
    private determineFragmentsOutputPath(extension);
    private projectDisplayName;
}
