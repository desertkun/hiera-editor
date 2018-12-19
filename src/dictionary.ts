export interface IDictionary<K, V> {
    getKeys(): K[];
    getValues(): V[];
    get(key: K): V;
    has(key: K): boolean;
    put(key: K, val: V): void;
    remove(key:K): void;
    clear(): void;
  }
  
  export class Dictionary<K extends string, V> implements IDictionary<K, V> {
  
    readonly internalDict: any;
  
    constructor() {
      this.internalDict = {};
    }
  
    public getKeys(): K[] {
      // @ts-ignore
      return Object.keys(this.internalDict);
    }
  
    public getValues(): V[] {
      // @ts-ignore
      return Object.values(this.internalDict);
    }

    *[Symbol.iterator]()
    {
        for (let i of this.internalDict)
        {
            yield i;
        }
    }
  
    public get(key: K): V {
      // @ts-ignore
      return this.internalDict[key];
    }

    public has(key: K): boolean {
      return this.internalDict[key] != null;
    }
  
    public put(key: K, val: V): void {
      // @ts-ignore
      this.internalDict[key] = val;
    }
  
    public remove(key: K): void {
      delete this.internalDict[key];
    }

    public clear(): void {
      for (var key in this.internalDict) {
          delete this.internalDict[key];
      }
    }
  }