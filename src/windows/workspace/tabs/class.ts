import { IPC } from "../../../ipc/client";
import {WorkspaceTab} from "./tab";
import {WorkspaceRenderer} from "../renderer";
import { dialog } from "electron";
import { isNumber, isObject, isBoolean } from "util";

const ipc = IPC();

const Dialogs = require('dialogs');
const $ = require("jquery");
declare const JSONEditor: any;
const dialogs = Dialogs();

interface RenderedProperty
{
    value(): any;
    set(value: any): void;
    modified(value: boolean): void;
}

type PropertyChangedCallback = (value: any) => void;

interface PropertyRenderer
{
    render(group: any, propertyId: string, defaultValue: any, value: any, changed: PropertyChangedCallback): RenderedProperty;
}

class StringPropertyRenderer implements PropertyRenderer
{
    public render(group: any, propertyId: string, defaultValue: any, value: any, changed: PropertyChangedCallback): RenderedProperty
    {
        const zis = this;

        const textField = $('<input type="text" class="form-control form-control-sm" id="' + propertyId + '">')
            .appendTo(group)
            .val(value)
            .change(function()
            {
                changed($(this).val());
            });

        if (defaultValue)
        {
            $(textField).attr('placeholder', defaultValue);
        }

        return {
            value(): any
            {
                return textField.val();
            },
            set(value: any): void
            {
                textField.val(value);
            },
            modified(value: boolean): void
            {

            }
        };
    }
}

class HashPropertyRenderer implements PropertyRenderer
{
    public render(group: any, propertyId: string, defaultValue: any, value: any, changed: PropertyChangedCallback): RenderedProperty
    {
        const zis = this;

        group.parent().css('width', '100%');

        const div = $('<div class="hash-editor" id="' + propertyId + '"></div>')
            .appendTo(group);

        const editor = new JSONEditor(div[0], {
            modes: ['code', 'tree'],
            onChange: () => 
            {
                changed(editor.get());
            }
        });

        if (value != null)
        {
            editor.set(value);
        }

        return {
            value(): any
            {
                return editor.get();
            },
            set(value: any): void
            {
                editor.set(value);
            },
            modified(value: boolean): void
            {

            }
        };
    }
}

class EnumPropertyRenderer implements PropertyRenderer
{
    private readonly values: Array<string>;
    constructor(values: Array<string>)
    {
        this.values = values;
    }

    public render(group: any, propertyId: string, defaultValue: any, value: any, changed: PropertyChangedCallback): RenderedProperty
    {
        const zis = this;

        const select = $('<select class="selectpicker" id="' + propertyId + '"></select>').appendTo(group);

        for (const value_ of this.values)
        {
            const p_ = (value_ == value) ? " selected" : "";
            $('<option' + p_ + '>' + value_ + '</option>').appendTo(select);
        }

        select.selectpicker({
            style: "selectpicker-sm"
        }).change(function()
        {
            changed($(this).val());
        });

        return {
            value(): any
            {
                return select.val();
            },
            set(value: any): void
            {
                select.val(value);
                select.selectpicker('refresh');
            },
            modified(value: boolean): void
            {
                
            }
        };
    }
}

class NumberPropertyRenderer implements PropertyRenderer
{
    private isNumberKey(event: any)
    {
        var charCode = (event.which) ? event.which : event.keyCode;

        if (charCode != 46 && charCode > 31  && (charCode < 48 || charCode > 57))
            return false;

        return true;
    }  

    public render(group: any, propertyId: string, defaultValue: any, value: any, changed: PropertyChangedCallback): RenderedProperty
    {
        const zis = this;

        const textField = $('<input type="text" class="form-control form-control-sm" id="' + propertyId + '">')
            .appendTo(group)
            .val(value)
            .keypress(this.isNumberKey)
            .change(function()
            {
                changed(parseInt($(this).val()));
            });

        if (defaultValue != null)
        {
            $(textField).attr('placeholder', defaultValue);
        }

        return {
            value(): any
            {
                return textField.val();
            },
            set(value: any): void
            {
                textField.val(value);
            },
            modified(value: boolean): void
            {
                
            }
        };
    }
}

class BooleanPropertyRenderer implements PropertyRenderer
{
    public render(group: any, propertyId: string, defaultValue: any, value: any, changed: PropertyChangedCallback): RenderedProperty
    {
        const zis = this;

        const textField = $('<input type="checkbox" id="' + propertyId + '">')
            .appendTo(group)
            .bootstrapSwitch({
                state: value,
                size: 'small',
                onSwitchChange: (event: any, state: boolean) =>
                {
                    changed(state);
                }
            });

        return {
            value(): any
            {
                return textField.bootstrapSwitch('state');
            },
            set(value: any): void
            {
                textField.bootstrapSwitch('state', value, true);
            },
            modified(value: boolean): void
            {
                
            }
        };
    }
}

export class NodeClassTab extends WorkspaceTab
{
    protected info: any;
    protected className: string;
    protected nodePath: string;
    protected editor: any;
    protected renderedProperties: any;

    public constructor(path: Array<string>, buttonNode: any, contentNode: any, renderer: WorkspaceRenderer)
    {
        super(path, buttonNode, contentNode, renderer);

        this.renderedProperties = {};
    }
    
    public async focusIn(): Promise<void>
    {
        if (!(await ipc.isNodeClassValid(this.nodePath, this.className)))
        {
            await this.refresh();
        }
    }

    public async init(): Promise<any>
    {
        this.nodePath = this.path[0];
        this.className = this.path[1];
        this.info = await this.acquireInfo();
    }

    protected async acquireInfo(): Promise<any>
    {
        return await ipc.acquireNodeClass(this.nodePath, this.className);
    }

    private buildValue(classInfo: any): any
    {
        const properties: any = {};

        for (const property_name in classInfo.defaults)
        {
            const property = classInfo.defaults[property_name];

            if (property.hasOwnProperty("value"))
            {
                properties[property_name] = property.value;
            }
        }

        return properties
    }

    private getPropertyRenderer(type: any, value?: any): PropertyRenderer
    {
        if (type == null)
        {
            return this.getDefaultPropertyRenderer(value);
        }
        
        switch (type.type)
        {
            case "String":
            {
                switch(type.data)
                {
                    case "String":
                    {
                        return new StringPropertyRenderer();
                    }
                    case "Integer":
                    {
                        return new NumberPropertyRenderer();
                    }
                    case "Boolean":
                    {
                        return new BooleanPropertyRenderer();
                    }
                    case "Hash":
                    {
                        return new HashPropertyRenderer();
                    }
                    default:
                    {
                        return this.getDefaultPropertyRenderer(value);
                    }
                }
            }
            case "PuppetASTAccess":
            {
                switch (type.data.what.type.value)
                {
                    case "Optional":
                    {
                        return this.getPropertyRenderer(type.data.values[0]);
                    }
                    case "Enum":
                    {
                        const values: Array<string> = [];

                        for (const obj of type.data.values)
                        {
                            if (obj.value instanceof Object)
                            {
                                values.push(obj.value.value);
                            }
                            else
                            {
                                values.push(obj.value);
                            }
                        }

                        return new EnumPropertyRenderer(values);
                    }
                    default:
                    {
                        return this.getDefaultPropertyRenderer(value);
                    }
                }
            }
        }

        return this.getDefaultPropertyRenderer(value);
    }

    private getDefaultPropertyRenderer(value: any)
    {
        if (value != null)
        {
            if (isBoolean(value))
            {
                return new BooleanPropertyRenderer();
            }

            if (isObject(value))
            {
                return new HashPropertyRenderer();
            }

            if (isNumber(value))
            {
                return new NumberPropertyRenderer();
            }
        }

        return new StringPropertyRenderer();
    }

    protected noClassInfoText(): string
    {
        return "This object does not seem to be recognized, because of compilation issues."
    }

    public render(): any
    {
        if (this.info.classInfo == null)
        {
            const pad = $('<div class="container-w-padding-x2"></div>').appendTo(this.contentNode);
            $('<div class="alert alert-danger" role="alert"></div>').appendTo(pad).html(this.noClassInfoText());
        }

        if (this.hasHints())
        {
            const pad = $('<div class="container-w-padding-x2"></div>').appendTo(this.contentNode);

            for (const hint of this.getHints())
            {
                $('<div class="alert alert-warning" role="alert"></div>').appendTo(pad).html(hint.message);
            }
        }

        const editorHolder = $('<div class="w-100 node-class-properties"></div>').appendTo(this.contentNode);
        this.renderProperties(editorHolder);
        
        const description = this.getDescription();
        if (description != null && description != "")
        {
            const pad = $('<div class="container-w-padding-x2"></div>').appendTo(this.contentNode);
            const i = $('<i class="fas fa-question" title="Click to show documentation">').tooltip().appendTo(pad);

            const documentation = $('<pre></pre>').html(description).css("display", "none").appendTo(pad);

            i.click(() => {
                $(i).remove();
                $(documentation).show();
            });
        }
    }

    protected getDescription(): string
    {
        if (this.info.classInfo == null)
            return null;

        return this.info.classInfo.description;
    }

    protected getTag(tag: string, name: string): string
    {
        if (this.info.classInfo == null)
            return null;
            
        const tags = this.info.classInfo.tags;

        if (tags[tag] == null)
            return null;

        return tags[tag][name];
    }

    private fixedPropertyName(name: string): string
    {
        return name.replace(/:/g, "_");
    }

    private renderProperty(propertyName: string, node: any, required: boolean)
    {
        const zis = this;

        const propertyId = 'property-' + this.fixedPropertyName(propertyName);
        
        const humanName = propertyName.replace(/_/g, " ").replace(/\w\S*/g, function(txt){
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });

        const defaultValue = this.getDefaultValue(propertyName);
        const value: any = this.getPropertyValue(propertyName) || defaultValue;

        const label = $('<span class="text-small"></span>').appendTo(node);
        
        const modified = $('<a class="class-property-action" style="display: none;" title="Reset to default value">' + 
            '<i class="fas fa-trash"></i></a>').appendTo(label);
        const l = $('<label for="' + propertyId + '">' + humanName + '</label>').appendTo(label);

        const description = this.getTag("param", propertyName);

        if (description != null && description != "")
        {
            $('<i class="fas fa-question text-muted" style="padding-left: 8px;" title="' + description + '">').tooltip().appendTo(l);
        }
        
        if (required)
        {
            $(l).css('font-weight', "bold");
        }

        // show the modified marker is the class if there is any value to it (including null)
        if (this.hasDefaultValue(propertyName) && value != defaultValue)
        {
            modified.show();
            $(label).addClass("text-primary");
            $(node).addClass("modified");
        }

        const group = $('<div class="input-group"></div>').appendTo(node);

        let renderer;

        const typeInfo = this.getPropertyTypeInfo(propertyName);

        if (typeInfo != null)
        {
            renderer = this.getPropertyRenderer(typeInfo, value);
        }
        else
        {
            renderer = this.getDefaultPropertyRenderer(value);
        }

        const renderedProperty = this.renderedProperties[propertyName] = 
            renderer.render(group, propertyId, defaultValue, value, async function(value: any)
        {
            await zis.setProperty(propertyName, value);

            if (zis.hasDefaultValue(propertyName))
            {
                modified.show();
                label.addClass("text-primary");
                node.addClass("modified");
            }
        });
        
        modified.click(async () => {
            await zis.removeProperty(propertyName);
            modified.hide();
            label.removeClass("text-primary");
            node.removeClass("modified");
            renderedProperty.set(defaultValue);
        }).tooltip();
        
        const error = this.getPropertyErrorInfo(propertyName);
        if (error != null)
        {
            const p_ = $('<div class="input-group-append"></div>').appendTo(group);
            const tooltipTitle = "Cannot resolve defaults:<br/>" + error.message;
            $('<button class="btn btn-sm btn-outline-danger" type="button" data-toggle="tooltip" data-placement="left">' + 
                '<i class="fas fa-times"></i></button>').appendTo(p_).tooltip({
                    title: tooltipTitle,
                    html: true
                });
        }
        else
        {
            const hints = this.getPropertyHints(propertyName);

            if (hints != null && hints.length > 0)
            {
                const p_ = $('<div class="input-group-append"></div>').appendTo(group);

                const texts = [];

                for (const hint of hints)
                {
                    texts.push(hint.message);
                }

                const tooltipTitle = texts.join("<br/>");

                $('<button class="btn btn-sm btn-outline-warning" type="button" data-toggle="tooltip" data-placement="left">' + 
                '<i class="fas fa-exclamation-triangle"></i></button>').appendTo(p_).tooltip({
                    title: tooltipTitle,
                    html: true
                }).click(async () => {
                    
                    for (const hint of hints)
                    {
                        if (hint.kind == "VariableNotFound")
                        {
                            if (await new Promise<boolean>((resolve: any) => {
                                dialogs.confirm("Wold you like to define fake fact ${" + hint.variable + "}?", (result: boolean) =>
                                {
                                    resolve(result);
                                })
                            }))
                            {
                                const value = await new Promise<string>((resolve: any) => {
                                    dialogs.prompt("Enter a value for ${" + hint.variable + "}", "", (result: string) =>
                                    {
                                        resolve(result);
                                    })
                                });
            
                                if (value == null)
                                    return;

                                await ipc.setNodeFact(zis.nodePath, hint.variable, value);
                                await zis.refresh();
                            }

                            return;
                        }
                    }

                });
            }
        }
        
    }

    protected hasHints(): boolean
    {
        return this.info.hints != null && this.info.hints.length > 0;
    }

    protected getHints(): any[]
    {
        return this.info.hints;
    }

    protected getPropertyHints(propertyName: string): any[]
    {
        return this.info.propertyHints[propertyName];
    }

    protected getPropertyErrorInfo(propertyName: string): any
    {
        return this.info.errors[propertyName];
    }

    public getProperties(): Array<string>
    {
        if (this.info.classInfo == null)
            return [];

        return this.info.classInfo.fields;
    }

    public get defaults(): any
    {
        return this.info.defaults;
    }

    public get values(): any
    {
        return this.info.values;
    }

    public classInfo(): any
    {
        return this.info.classInfo;
    }

    protected getPropertyTypeInfo(propertyName: string): any
    {
        return this.info.types[propertyName];
    }

    protected getPropertyValue(propertyName: string): any
    {
        return this.values[propertyName];
    }

    protected getDefaultValue(propertyName: string): any
    {
        return this.defaults[propertyName];
    }

    protected hasDefaultValue(propertyName: string): boolean
    {
        return this.defaults.hasOwnProperty(propertyName);
    }

    protected async setProperty(propertyName: string, value: any)
    {
        await ipc.setNodeClassProperty(this.nodePath, this.className, propertyName, value);
    }

    protected async removeProperty(propertyName: string)
    {
        await ipc.removeNodeClassProperty(this.nodePath, this.className, propertyName);
    }

    public getIcon(): any
    {
        const iconData = this.info.icon;

        if (iconData != null)
        {
            return $('<img class="node-entry-icon" src="' + iconData + '" style="width: 16px; height: 16px;">');
        }
        else
        {
            return $('<i class="fas fa-puzzle-piece"></i>');
        }
    }

    private renderProperties(node: any)
    {
        const container = $('<div class="flex-container"></div>').appendTo(node);

        const classFields = this.getProperties();
        classFields.sort();

        // required fields first
        
        let hadRequiredField = false;

        for (const fieldName of classFields)
        {
            if (this.hasDefaultValue(fieldName))
                continue;

            const inputGroup = $('<div class="node-class-property flex-item"></div>').appendTo(container);
            this.renderProperty(fieldName, inputGroup, true);

            hadRequiredField = true;
        }

        if (hadRequiredField)
        {
            $('<hr>').appendTo(container);
        }

        // non-required fields last

        for (const fieldName of classFields)
        {
            if (!this.hasDefaultValue(fieldName))
                continue;
                
            const inputGroup = $('<div class="node-class-property flex-item"></div>').appendTo(container);
            this.renderProperty(fieldName, inputGroup, false);
        }
    }

    async release(): Promise<any>
    {

    }

    get shortTitle(): string
    {
        return this.className;
    }

    get fullTitle(): string
    {
        return this.path.join("/");
    }

}