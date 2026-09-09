import type { FC } from 'react';

type ComponentRegistry = Record<string, FC<any>>;

class PluginRegistry {
    private components: ComponentRegistry = {};

    register(elementId: string, component: FC<any>) {
        this.components[elementId] = component;
    }

    get(elementId: string): FC<any> | undefined {
        return this.components[elementId];
    }

    getAll(): ComponentRegistry {
        return this.components;
    }
}

export const pluginRegistry = new PluginRegistry();
