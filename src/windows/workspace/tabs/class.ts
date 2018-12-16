import {ipc} from "../../../ipc/client";
import {WorkspaceTab} from "./tab";
import {WorkspaceRenderer} from "../renderer";

const $ = require("jquery");

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

    private getPropertyRenderer(type: any): PropertyRenderer
    {
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
                }
            }
        }

        return new StringPropertyRenderer();
    }

    public render(): any
    {
        const editorHolder = $('<div class="w-100 node-class-properties"></div>').appendTo(this.contentNode);

        this.renderProperties(editorHolder);
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
            renderer = this.getPropertyRenderer(typeInfo);
        }
        else
        {
            renderer = new StringPropertyRenderer();
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
            const b_ = $('<button class="btn btn-sm btn-outline-warning" type="button" data-toggle="tooltip" data-placement="left">' + 
                '<i class="fas fa-exclamation-triangle"></i></button>').appendTo(p_).tooltip({
                    title: tooltipTitle,
                    html: true
                });
        }

        
    }

    protected getPropertyErrorInfo(propertyName: string): any
    {
        return this.info.errors[propertyName];
    }

    public getProperties(): Array<string>
    {
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