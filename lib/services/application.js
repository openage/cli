import * as context from './context.js'
import * as oa from './oa.js'
import * as input from '../helpers/input.js'
import { settings } from '../helpers/data.js'
// const file  from  '../helpers/file')
// const HttpClient  from  './http-client')

class Application {
    async init() {
        let application = context.application()

        if (!application) {

            let host = settings.get('application.host')
            if (!host) {
                host = await input.get('host')
                settings.set('application.host', host)
            }

            let systemService = settings.get('services.config.url')
            if (!systemService) {
                systemService = await input.get('system-service')
                settings.set('services.config.url', systemService)
            }
            const env = context.env()
            const applicationCode = env ? `host:${host}?env=${env}` : `host:${host}`
            application = await oa.config.applications.get(applicationCode, context.toObject())
            application = this.overrides(application)
            application.timeStamp = application.timeStamp || new Date()
            application.navs = await this.populateNav(application.navs)
            application.services = await this.populateService(application.services)
            context.application(application)

            let tenant = await oa.directory.tenants.get(application.tenant.code, context.toObject())
            context.tenant(tenant)

            if (application.organization) {
                let organization = await oa.directory.organizations.get(application.organization.code, context.toObject())
                context.organization(organization)
            }
        }

        // context.show()
        return context
    }

    overrides(data) {
        const configNavs = settings.get('navs')
        if (configNavs?.length) {
            const navs = []
            const appNavs = (data.navs || []).map(n => typeof n === 'string' ? { code: n } : n)
            const envNavs = configNavs.map(n => typeof n === 'string' ? { code: n } : n)

            appNavs.forEach(n => {
                let overrideNav = envNavs.find(i => i.code && n.code && i.code.toLowerCase() === n.code.toLowerCase())
                navs.push(overrideNav || n)
            })

            navs.push(...envNavs.filter(o => !appNavs.find(n => n.code && n.code === o.code)))
            data.navs = navs
        }

        const configServices = settings.get('application.services')
        if (configServices?.length) {
            const services = configServices.map(s => s)

            if (data.services && data.services.length) {
                data.services.forEach(service => {
                    if (!services.find(s => s.code === service.code)) {
                        services.push(service)
                    }
                })
            }

            data.services = services
        }

        data.theme = data.theme || settings.get('application.theme')
        data.meta = data.meta || {}
        data.links = data.links || settings.get('application.links')

        return data
    }

    async populateService(services) {
        // for (const service of services) {
        //     let specs = service.specs || `${service.url}/specs`
        //     if (specs.startsWith('http')) {
        //         specs = await new HttpClient().get(specs, {
        //             fallback: async () => {
        //                 return file.read({
        //                     folder: ['$data', 'specs'],
        //                     file: `${service.code}.json`
        //                 })
        //             }
        //         })
        //     }

        //     service.specs = specs
        // }

        return services
    }

    async populateNav(navs) {
        return navs
        // TODO: fixe me
        // const items = []
        // for (const nav of navs) {
        //     items.push(await this.getNav(nav))
        // }
        // return items
    }

    async getNav(link) {
        const src = typeof link === 'string' ? link : (link.src || link.code)
        let l = link

        // if (src.startsWith('http') || src.startsWith('/')) {
        //     l = await new HttpClient().get(src)
        // }

        // const meta = l.meta || l.layout

        // if (meta && typeof meta === 'string' && (meta.startsWith('http') || meta.startsWith('/'))) {
        //     l.meta = await new HttpClient().get(meta)
        // }

        if (l.items && l.items.length) {
            l.items = await this.populateNav(l.items)
        }

        return l
    }
}

export default new Application()
