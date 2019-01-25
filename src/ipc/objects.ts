
export interface ClassInfoDump
{
    name: string;
    file: string;
    defaults: any;
    inherits: string;
    description: string;
    options: any;
    tags: any;
}

export interface DefiledTypeInfoDump
{
    name: string;
    file: string;
    defaults: any;
    inherits: string;
    description: string;
    options: any;
    tags: any;
}

export interface HierarchyEntryDump
{
    name: string;
    path: string;
    eyaml: boolean;
}

export interface ClassDump
{
    icon?: string;
    values: { [key:string]: any };
    classInfo: ClassInfoDump;
    modified: { [key:string]: number };
    types: any;
    errors: any;
    hints: any[];
    propertyHints: any;
    fields: string[];
    requiredFields: string[];
    hierarchy: HierarchyEntryDump[];
}

export interface ResourceDump
{
    icon?: string;
    values: { [key:string]: any };
    definedTypeInfo: DefiledTypeInfoDump;
    modified: { [key:string]: number };
    options: { [key:string]: any };
    types: any;
    errors: any;
    hints: any[];
    propertyHints: any;
    fields: string[];
    requiredFields: string[];
    hierarchyLevel: number;
    hierarchy: HierarchyEntryDump[];
}

export interface NodeDefinedTypeDump
{
    definedType: DefiledTypeInfoDump,
    titles: { [key: string]: {
        options: any;
    } }
}

export interface NodeDump
{
    classes: { [key:string]: ClassInfoDump };
    resources: { [key:string]: NodeDefinedTypeDump };
    hierarchy: HierarchyEntryDump[];
    hiera_includes: {[key: string]: number};
    hiera_resources: {[key: string]: number};
}

export interface EnvironmentTreeDump
{
    nodes: {[key: string]: NodeDump};
    warnings: {title: string; message: string}[];
}