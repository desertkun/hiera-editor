export interface IDictionary<K, V> {
    getKeys(): K[];
    getValues(): V[];
    get(key: K): V;
    has(key: K): boolean;
    put(key: K, val: V): void;
    remove(key:K): void;
  }
  
  export class Dictionary<K extends string, V> implements IDictionary<K, V> {
  
    private internalDict: Partial<Record<K, V>>;
  
    constructor() {
      this.internalDict = {};
    }
  
    public getKeys(): K[] {
      let keys: K[] = [];
      for(let key in this.internalDict) {
        keys.push(key);
      }
  
      return keys;
    }
  
    public getValues(): V[] {
      let vals: V[] = [];
  
      for(let key in this.internalDict) {
        vals.push(this.internalDict[key]);
      }
  
      return vals;
    }
  
    public get(key: K): V {
      return this.internalDict[key];
    }

    public has(key: K): boolean {
      return this.internalDict[key] != null;
    }
  
    public put(key: K, val: V): void {
      this.internalDict[key] = val;
    }
  
    public remove(key: K): void {
      delete this.internalDict[key];
    }
  }