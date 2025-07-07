const context = require('./context');
const config = require('config');
const oa = require('@open-age/client');

const input = require('../helpers/input');

const HttpClient = require('./http-client');

const file = require('../helpers/file');

class Application {
    async init() {
        let application = context.application();

        if (!application) {

            let host = await input.get('host');
            let env = await input.get('env');

            const applicationCode = `host:${host}?env=${env}`;
            application = await oa.system.applications.get(applicationCode, context.toObject());
            application = this.overrides(application);
            application.timeStamp = application.timeStamp || new Date();
            application.navs = await this.populateNav(application.navs);
            application.services = await this.populateService(application.services);
            context.application(application);

            let tenant = await oa.directory.tenants.get(application.tenant.code, context.toObject());
            context.tenant(tenant);

            if (application.organization) {
                let organization = await oa.directory.organizations.get(application.organization.code, context.toObject());
                context.organization(organization);
            }
        }

        context.show();
        return context;

    }

    overrides(data) {
        if (config.navs && config.navs.length) {
            const navs = [];
            const appNavs = (data.navs || []).map(n => typeof n === 'string' ? new Link({ code: n }) : new Link(n));
            const envNavs = config.navs.map(n => typeof n === 'string' ? new Link({ code: n }) : new Link(n));

            appNavs.forEach(n => {
                let overrideNav = envNavs.find(i => i.code && n.code && i.code.toLowerCase() === n.code.toLowerCase());
                navs.push(overrideNav || n);
            });

            navs.push(...envNavs.filter(o => !appNavs.find(n => n.code && n.code === o.code)));
            data.navs = navs;
        }

        if (config.services && config.services.length) {
            const services = config.services.map(s => new Service(s));

            if (data.services && data.services.length) {
                data.services.forEach(service => {
                    if (!services.find(s => s.code === service.code)) {
                        services.push(service);
                    }
                });
            }

            data.services = services;
        }

        data.theme = data.theme || config.theme;
        data.meta = data.meta || {};
        data.links = data.links || config.links;

        return data;
    }

    async populateService(services) {
        for (const service of services) {
            let specs = service.specs || `${service.url}/specs`
            if (specs.startsWith('http')) {
                specs = await new HttpClient().get(specs, {
                    fallback: async () => {
                        return file.read({
                            folder: ['$data', 'specs'],
                            file: `${service.code}.json`
                        })
                    }
                })
            }

            service.specs = specs;
        }

        return services;
    }

    async populateNav(navs) {
        return navs // TODO: fixe me
        const items = [];
        for (const nav of navs) {
            items.push(await this.getNav(nav));
        }
        return items;
    }

    async getNav(link) {
        const src = typeof link === 'string' ? link : (link.src || link.code);
        let l = link;

        if (src.startsWith('http') || src.startsWith('/')) {
            l = await new HttpClient().get(src);
        }

        const meta = l.meta || l.layout;

        if (meta && typeof meta === 'string' && (meta.startsWith('http') || meta.startsWith('/'))) {
            l.meta = await new HttpClient().get(meta);
        }

        if (l.items && l.items.length) {
            l.items = await this.populateNav(l.items);
        }

        return new Link(l);
    }
}

module.exports = new Application();
