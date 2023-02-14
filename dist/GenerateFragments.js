"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var chalk_1 = require("chalk");
var fs = require("fs-extra");
var graphql_import_1 = require("graphql-import");
var lodash_1 = require("lodash");
var path = require("path");
var graphql_1 = require("graphql");
var utilities_1 = require("graphql/utilities");
var modelConfigs = JSON.parse(fs.readFileSync('../../server/model_configs.json', 'utf-8'));
var filterFieldList = function (name, type, fields) {
    if (!(name in modelConfigs)) {
        return [];
    }
    var modelConfig = modelConfigs[name];
    var allow = modelConfig[type];
    return fields.filter(function (field) { return allow.indexOf(field) === -1; });
};
function flatten(arr) {
    var res = [];
    arr.forEach(function (sub) {
        if (!sub) {
            return;
        }
        sub.forEach(function (v) {
            res.push(v);
        });
    });
    return res;
}
var GenerateFragments = /** @class */ (function () {
    function GenerateFragments(context, argv) {
        var _this = this;
        this.context = context;
        this.argv = argv;
        this.fragmentType = {
            DEFAULT: "",
            NO_RELATIONS: "NoNesting",
            DEEP: "DeepNesting"
        };
        this.projectDisplayName = function () { return chalk_1.default.green(_this.projectName); };
    }
    GenerateFragments.prototype.handle = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, projects, _i, _b, projectName, project;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = this;
                        return [4 /*yield*/, this.context.getConfig()];
                    case 1:
                        _a.config = _c.sent();
                        projects = this.getProjectConfig();
                        // Process each project
                        for (_i = 0, _b = Object.keys(projects); _i < _b.length; _i++) {
                            projectName = _b[_i];
                            project = projects[projectName];
                            this.setCurrentProject(project, projectName);
                            // if (this.argv.bundle) {
                            //   this.bundle()
                            // }
                            // if (this.argv.graphql) {
                            this.fragments();
                            // }
                            this.save();
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    GenerateFragments.prototype.setCurrentProject = function (project, projectName) {
        this.project = project;
        this.projectName = projectName;
        this.fragmentsExtensionConfig = undefined;
    };
    GenerateFragments.prototype.fragments = function () {
        var fragmentsExtensionConfig;
        if (this.argv.project ||
            (!this.argv.project &&
                (lodash_1.has(this.project.config, "extensions.generate-fragments") ||
                    lodash_1.has(this.project.config, "extensions.fragments")))) {
            this.context.spinner.start("Generating fragments for project " + this.projectDisplayName() + "...");
            fragmentsExtensionConfig = this.processFragments(this.fragmentsExtensionConfig
                ? this.fragmentsExtensionConfig["generate-fragments"]
                : undefined);
            lodash_1.merge(this.project.extensions, fragmentsExtensionConfig);
            this.context.spinner.succeed("Fragments for project " + this.projectDisplayName() + " written to " + chalk_1.default.green(fragmentsExtensionConfig["generate-fragments"].output));
        }
        else if (this.argv.verbose) {
            this.context.spinner.info("Generate Fragments not configured for project " + this.projectDisplayName() + ". Skipping");
        }
    };
    GenerateFragments.prototype.save = function () {
        if (this.argv.save) {
            var configFile = path.basename(this.config.configPath);
            this.context.spinner.start("Saving configuration for project " + this.projectDisplayName() + " to " + chalk_1.default.green(configFile) + "...");
            this.saveConfig();
            this.context.spinner.succeed("Configuration for project " + this.projectDisplayName() + " saved to " + chalk_1.default.green(configFile));
        }
    };
    GenerateFragments.prototype.getProjectConfig = function () {
        var _this = this;
        var projects;
        if (this.argv.project) {
            if (Array.isArray(this.argv.project)) {
                projects = {};
                this.argv.project.map(function (p) {
                    return lodash_1.merge(projects, (_a = {}, _a[p] = _this.config.getProjectConfig(p), _a));
                    var _a;
                });
            }
            else {
                // Single project mode
                projects = (_a = {},
                    _a[this.argv.project] = this.config.getProjectConfig(this.argv.project),
                    _a);
            }
        }
        else {
            // Process all projects
            projects = this.config.getProjects();
        }
        if (!projects) {
            throw new Error("No projects defined in config file");
        }
        return projects;
        var _a;
    };
    GenerateFragments.prototype.processFragments = function (schemaPath) {
        var _this = this;
        var generator = this.determineGenerator();
        // TODO: This does not support custom generators
        var extension = generator.endsWith("js") ? "js" : "graphql";
        var outputPath = this.determineFragmentsOutputPath(extension);
        var schema = this.determineInputSchema(schemaPath);
        var schemaContents = graphql_import_1.importSchema(schema); //******************************************* */
        var fragments = this.makeFragments(schemaContents, extension);
        if (fragments.length > 0) {
            fragments.map(function (_a) {
                var name = _a.name, fragment = _a.fragment;
                fs.writeFileSync(outputPath.replace(_this.projectName + ".fragments." + extension, name + ".graphql"), fragment, { flag: "w" });
            });
        }
        else {
            fs.writeFileSync(outputPath, fragments[0], { flag: "w" });
        }
        return {
            "generate-fragments": { output: outputPath, generator: generator }
        };
    };
    /**
     *
     */
    GenerateFragments.prototype.indentedLine = function (level) {
        var line = "\n";
        for (var i = 0; i < level; i++) {
            line += "  ";
        }
        return line;
    };
    GenerateFragments.prototype.makeFragments = function (schemaContents, generator) {
        var _this = this;
        var document = graphql_1.parse(schemaContents, { noLocation: true });
        var ast = utilities_1.buildASTSchema(document);
        var typeNames = Object.keys(ast.getTypeMap())
            .filter(function (typeName) {
            return ast.getType(typeName) !== undefined;
        })
            .filter(function (typeName) {
            return ast.getType(typeName).constructor.name === "GraphQLObjectType";
        })
            .filter(function (typeName) { return !typeName.startsWith("__"); })
            .filter(function (typeName) { return typeName !== ast.getQueryType().name; })
            .filter(function (typeName) {
            return ast.getMutationType()
                ? typeName !== ast.getMutationType().name
                : true;
        })
            .filter(function (typeName) {
            return ast.getSubscriptionType()
                ? typeName !== ast.getSubscriptionType().name
                : true;
        })
            .sort(function (a, b) {
            return ast.getType(a).constructor.name < ast.getType(b).constructor.name
                ? -1
                : 1;
        });
        // console.log(typeNames)
        var standardFragments = typeNames.map(function (typeName) {
            var type = ast.getType(typeName);
            var name = type.name;
            var fields = _this.generateFragments(type, ast);
            if (fields.length === 0)
                return null;
            return {
                name: name,
                fragment: "fragment " + name + " on " + name + " {\n  " + fields.join(_this.indentedLine(1)) + "\n}\n"
            };
        }).filter(function (frag) { return frag != null; });
        var noRelationsFragments = typeNames.map(function (typeName) {
            var type = ast.getType(typeName);
            var name = type.name;
            var fields = _this.generateFragments(type, ast, _this.fragmentType.NO_RELATIONS);
            if (fields.length === 0)
                return null;
            return {
                name: name,
                fragment: "fragment " + name + _this.fragmentType.NO_RELATIONS + " on " + name + " {\n  " + fields.join(_this.indentedLine(1)) + "\n}\n"
            };
        }).filter(function (frag) { return frag != null; });
        var deepFragments = flatten(typeNames.map(function (typeName) {
            var type = ast.getType(typeName);
            var name = type.name;
            var fields = _this.generateFragments(type, ast, _this.fragmentType.DEEP);
            if (fields.length === 0)
                return null;
            if (modelConfigs[name]) {
                return Object.keys(modelConfigs[name]).map(function (suffix) {
                    var allowlist = modelConfigs[name][suffix];
                    if (!allowlist.length) {
                        return undefined;
                    }
                    var spreadFragments = [];
                    if (name === 'Admin') {
                        spreadFragments.push('...AdminListing');
                    }
                    if (name === 'Public') {
                        spreadFragments.push('...PublicListing');
                    }
                    if (spreadFragments.length) {
                        spreadFragments.push(''); // Adds an extra newline at the end which we want
                    }
                    return {
                        name: name + "Listing",
                        fragment: "fragment " + name + "Listing on " + name + " {\n  " + spreadFragments.join(_this.indentedLine(1)) + fields.filter(function (f) { return allowlist.indexOf(f) !== -1; }).join(_this.indentedLine(1)) + "\n}\n",
                    };
                });
            }
            else {
                return [{
                        name: name,
                        fragment: "fragment " + name + _this.fragmentType.DEEP + " on " + name + " {\n  " + fields.join(_this.indentedLine(1)) + "\n}\n",
                    }];
            }
        }));
        if (generator === "js") {
            return [{
                    name: '*',
                    fragment: "// THIS FILE HAS BEEN AUTO-GENERATED BY \"graphql-cli-generate-fragments\"\n// DO NOT EDIT THIS FILE DIRECTLY\n" + standardFragments
                        .map(function (_a) {
                        var name = _a.name, fragment = _a.fragment;
                        return "\nexport const " + name + "Fragment = `" + fragment + "`\n";
                    })
                        .join("") + "\n" + noRelationsFragments
                        .map(function (_a) {
                        var name = _a.name, fragment = _a.fragment;
                        return "\nexport const " + name + _this.fragmentType.NO_RELATIONS + "Fragment = `" + fragment + "`\n";
                    })
                        .join("") + "\n" + deepFragments
                        .map(function (_a) {
                        var name = _a.name, fragment = _a.fragment;
                        return "\nexport const " + name + _this.fragmentType.DEEP + "Fragment = `" + fragment + "`\n";
                    })
                        .join("") + "\n"
                }];
        }
        if (generator === "multi-file-graphql") {
            return deepFragments;
        }
        return [{
                name: '*',
                fragment: "# THIS FILE HAS BEEN AUTO-GENERATED BY \"graphql-cli-generate-fragments\"\n# DO NOT EDIT THIS FILE DIRECTLY\n\n# Standard Fragments\n# Nested fragments will spread one layer deep\n\n" + standardFragments
                    .map(function (_a) {
                    var name = _a.name, fragment = _a.fragment;
                    return "\n" + fragment;
                })
                    .join("") + "\n\n# No Relational objects\n# No nested fragments\n\n" + noRelationsFragments
                    .map(function (_a) {
                    var name = _a.name, fragment = _a.fragment;
                    return "\n" + fragment;
                })
                    .join("") + "\n\n# Deeply nested Fragments\n# Will include n nested fragments\n# If there is a recursive relation you will receive a\n# \"Cannot spread fragment within itself\" error when using\n\n" + deepFragments
                    .map(function (_a) {
                    var name = _a.name, fragment = _a.fragment;
                    return "\n" + fragment;
                })
                    .join("") + "\n"
            }];
    };
    GenerateFragments.prototype.generateFragments = function (type, ast, fragmentType) {
        var _this = this;
        if (fragmentType === void 0) { fragmentType = this.fragmentType.DEFAULT; }
        var fields = type.getFields();
        var fragmentFields = Object.keys(fields)
            .map(function (field) {
            return _this.printField(field, fields[field], ast, fragmentType);
        })
            // Some fields should not be printed, ie. fields with relations.
            // Remove those from the output by returning null from printField.
            .filter(function (field) { return field != null; });
        return fragmentFields;
    };
    GenerateFragments.prototype.printField = function (fieldName, field, ast, fragmentType, indent) {
        if (indent === void 0) { indent = 1; }
        var constructorName = field.type.constructor.name && field.type.constructor.name;
        if (constructorName === "Object")
            constructorName =
                (field.type.name &&
                    ast.getType(field.type.name.value).constructor.name) ||
                    null;
        if (constructorName === "GraphQLList") {
            field =
                (field.astNode.type.type.type && field.astNode.type.type.type) ||
                    ((field.astNode.type.type && field.astNode.type.type) || null);
            if (field === null) {
                throw new Error("Schema malformed - list");
            }
            constructorName = ast.getType(field.name.value).constructor.name;
        }
        if (constructorName === "GraphQLNonNull" || field.kind === "NonNullType") {
            field = (field.astNode.type && field.astNode.type) || field.type;
            constructorName =
                (field.type.name &&
                    ast.getType(field.type.name.value).constructor.name) ||
                    null;
            if (constructorName === null) {
                field = (field.type && field.type) || null;
                constructorName =
                    (field.type.name &&
                        ast.getType(field.type.name.value).constructor.name) ||
                        null;
            }
        }
        if (constructorName === "GraphQLScalarType" ||
            constructorName === "GraphQLEnumType") {
            return fieldName;
        }
        if (constructorName === "GraphQLObjectType") {
            if (fragmentType === this.fragmentType.NO_RELATIONS)
                return null;
            var typeName = null;
            // if(field.name !== undefined)
            typeName =
                (field.name && field.name.value) ||
                    ((field.type.name.value && field.type.name.value) || field.type.name);
            return (fieldName +
                " {" +
                this.indentedLine(indent + 1) +
                "..." +
                ("" + ((fragmentType === this.fragmentType.DEEP &&
                    typeName + this.fragmentType.DEEP) ||
                    (fragmentType === this.fragmentType.DEFAULT &&
                        typeName + this.fragmentType.NO_RELATIONS) ||
                    typeName + this.fragmentType.DEFAULT)) +
                this.indentedLine(indent) +
                "}");
        }
        return null;
    };
    /****************************** */
    GenerateFragments.prototype.saveConfig = function () {
        if (lodash_1.has(this.project.config, "extensions.fragments")) {
            delete this.project.config.extensions.fragments;
        }
        this.config.saveConfig(this.project.config, this.projectName);
    };
    /**
     * Determine input schema path for binding. It uses the resulting schema from bundling (if available),
     * then looks at bundle extension (in case bundling ran before), then takes the project schemaPath.
     * Also checks if the file exists, otherwise it throws and error.
     *
     * @param {(string | undefined)} schemaPath Schema path from bundling
     * @returns {string} Input schema path to be used for binding generation.
     */
    GenerateFragments.prototype.determineInputSchema = function (schemaPath) {
        var bundleDefined = lodash_1.has(this.project.config, "extensions.prepare-bundle.output");
        var oldBundleDefined = lodash_1.has(this.project.config, "extensions.bundle.output");
        // schemaPath is only set when bundle ran
        if (!schemaPath) {
            if (bundleDefined) {
                // Otherwise, use bundle output schema if defined
                schemaPath = lodash_1.get(this.project.config, "extensions.prepare-bundle.output");
            }
            else if (oldBundleDefined) {
                schemaPath = lodash_1.get(this.project.config, "extensions.bundle.output");
            }
            else if (this.project.schemaPath) {
                // Otherwise, use project schemaPath
                schemaPath = this.project.schemaPath;
            }
            else {
                throw new Error("Input schema cannot be determined.");
            }
        }
        console.log(schemaPath);
        var getExtension = function (str) { return str.split('.').pop(); };
        if (getExtension(schemaPath) !== 'graphql' && getExtension(schemaPath) !== 'gql') {
            throw new Error("Schema has an extension of '." + getExtension(schemaPath) + "'\n- Only '.graphql' schema's are supported by 'generate-fragments'.");
        }
        if (fs.existsSync(schemaPath)) {
            return schemaPath;
        }
        else {
            throw new Error("Schema '" + schemaPath + "' not found." + (bundleDefined ? " Did you run bundle/get-schema first?" : ""));
        }
    };
    /**
     * Determine input schema path for bundling.
     *
     * @returns {string} Input schema path for bundling
     */
    GenerateFragments.prototype.determineSchemaPath = function () {
        if (this.project.schemaPath) {
            return this.project.schemaPath;
        }
        throw new Error("No schemaPath defined for project '" + this.projectName + "' in config file.");
    };
    /**
     * Determine generator. Provided generator takes precedence over value from config
     *
     * @param {string} generator Command line parameter for generator
     * @returns {string} Generator to be used
     */
    GenerateFragments.prototype.determineGenerator = function () {
        if (this.argv.generator) {
            return this.argv.generator;
        }
        if (lodash_1.has(this.project.config, "extensions.generate-fragments.generator")) {
            return lodash_1.get(this.project.config, "extensions.generate-fragments.generator");
        }
        throw new Error("Generator cannot be determined. No existing configuration found and no generator parameter specified.");
    };
    /**
     * Determine output path for fragments. Provided path takes precedence over value from config
     *
     * @param {string} extension File extension for output file
     * @returns Output path
     */
    GenerateFragments.prototype.determineFragmentsOutputPath = function (extension) {
        var outputPath;
        if (this.argv.output) {
            outputPath = path.join(this.argv.output, this.projectName + ".fragments." + extension);
        }
        else if (lodash_1.has(this.project.config, "extensions.generate-fragments.output")) {
            outputPath = lodash_1.get(this.project.config, "extensions.generate-fragments.output");
        }
        else {
            throw new Error("Output path cannot be determined. No existing configuration found and no output parameter specified.");
        }
        fs.ensureDirSync(path.dirname(outputPath));
        return outputPath;
    };
    return GenerateFragments;
}());
exports.GenerateFragments = GenerateFragments;
//# sourceMappingURL=GenerateFragments.js.map