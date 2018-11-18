import {ipc} from "../../../ipc/client";
import {WorkspaceTab} from "./tab";
import {WorkspaceRenderer} from "../renderer";

const $ = require("jquery");

interface RenderedProperty
{
    value(): any;
    set(value: any): void;
}

type PropertyChangedCallback = (value: any) => void;

interface PropertyRenderer
{
    render(group: any, propertyId: string, property: any, value: any, changed: PropertyChangedCallback): RenderedProperty;
}

class StringPropertyRenderer implements PropertyRenderer
{
    public render(group: any, propertyId: string, property: any, value: any, changed: PropertyChangedCallback): RenderedProperty
    {
        const textField = $('<input type="text" class="form-control form-control-sm" id="' + propertyId + '">')
            .appendTo(group)
            .val(value)
            .change(function()
            {
                changed($(this).val());
            });

        if (property.value)
        {
            $(textField).attr('placeholder', property.value);
        }

        return {
            value(): any
            {
                return textField.val();
            },
            set(value: any): void
            {
                textField.val(value);
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

    public render(group: any, propertyId: string, property: any, value: any, changed: PropertyChangedCallback): RenderedProperty
    {
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

    public render(group: any, propertyId: string, property: any, value: any, changed: PropertyChangedCallback): RenderedProperty
    {
        const textField = $('<input type="text" class="form-control form-control-sm" id="' + propertyId + '">')
            .appendTo(group)
            .val(value)
            .keypress(this.isNumberKey);

        if (property.value)
        {
            $(textField).attr('placeholder', property.value);
        }

        return {
            value(): any
            {
                return textField.val();
            },
            set(value: any): void
            {
                textField.val(value);
            }
        };
    }
}

class BooleanPropertyRenderer implements PropertyRenderer
{
    public render(group: any, propertyId: string, property: any, value: any, changed: PropertyChangedCallback): RenderedProperty
    {
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
                textField.bootstrapSwitch('state', value);
            }
        };
    }
}

export class NodeClassTab extends WorkspaceTab
{
    private info: any;
    private className: string;
    private nodePath: string;
    private editor: any;
    private renderedProperties: any;

    public constructor(path: Array<string>, buttonNode: any, contentNode: any, renderer: WorkspaceRenderer)
    {
        super(path, buttonNode, contentNode, renderer);

        this.renderedProperties = {};
    }

    async init(): Promise<any>
    {
        this.nodePath = this.path[0];
        this.className = this.path[1];
        this.info = await ipc.acquireNodeClass(this.nodePath, this.className);
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

    public classFields(): Array<string>
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

    public render(): any
    {
        const editorHolder = $('<div class="w-100 node-class-properties"></div>').appendTo(this.contentNode);

        this.renderProperties(editorHolder);
    }

    private fixedPropertyName(name: string): string
    {
        return name.replace(/:/g, "_");
    }

    private renderProperty(propertyName: string, node: any)
    {
        const zis = this;

        const propertyId = 'property-' + this.fixedPropertyName(propertyName);
        
        const humanName = propertyName.replace(/_/g, " ").replace(/\w\S*/g, function(txt){
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });

        const property: any = this.defaults[propertyName];
        const defaultValue = property.value;
        const value: any = this.values[propertyName] || defaultValue;

        const label = $('<span class="text-small"></span>').appendTo(node);
        
        const modified = $('<a class="class-property-action" style="display: none;" title="Reset to default value">' + 
            '<i class="fas fa-trash"></i></a>').appendTo(label);
        $('<label for="' + propertyId + '">' + humanName + '</label>').appendTo(label);

        // show the modified marker is the class if there is any value to it (including null)
        if (this.values.hasOwnProperty(propertyName))
        {
            modified.show();
            $(label).addClass("text-primary");
        }

        const group = $('<div class="input-group"></div>').appendTo(node);

        let renderer, type;

        if (property.hasOwnProperty("type"))
        {
            type = property.type;
            renderer = this.getPropertyRenderer(property.type);
        }
        else
        {
            type = null;
            renderer = new StringPropertyRenderer();
        }

        const renderedProperty = this.renderedProperties[propertyName] = renderer.render(group, propertyId, property, value, async function(value: any)
        {
            await ipc.setNodeClassProperty(zis.nodePath, zis.className, propertyName, value);

            modified.show();
            label.addClass("text-primary");
        });
        
        modified.click(async () => {
            await ipc.removeNodeClassProperty(zis.nodePath, zis.className, propertyName);
            modified.hide();
            label.removeClass("text-primary");
            renderedProperty.set(defaultValue);
        }).tooltip();
        
        if (property.hasOwnProperty("error"))
        {
            const p_ = $('<div class="input-group-append"></div>').appendTo(group);
            const tooltipTitle = "Cannot resolve defaults:<br/>" + property.error.message;
            const b_ = $('<button class="btn btn-sm btn-outline-warning" type="button" data-toggle="tooltip" data-placement="left">' + 
                '<i class="fas fa-exclamation-triangle"></i></button>').appendTo(p_).tooltip({
                    title: tooltipTitle,
                    html: true
                });
        }

        
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

        const classFields = this.classFields();
        classFields.sort();

        for (const fieldName of classFields)
        {
            const inputGroup = $('<div class="node-class-property flex-item"></div>').appendTo(container);
            this.renderProperty(fieldName, inputGroup);
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