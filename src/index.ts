import type { ItemsService } from '@directus/api/services/items'
import type { FilesService } from '@directus/api/services/files'
import type { TranslationsService } from '@directus/api/services/translations'
import type { NotificationsService } from '@directus/api/services/notifications'
import { createError } from '@directus/errors'
import type { ApiExtensionContext, EndpointExtensionContext, HookConfig as DirectusHookConfig, OperationContext, OperationHandler } from '@directus/extensions'
import type { Accountability, Item } from '@directus/types'
import { z } from 'zod'

export type BasicContext = ApiExtensionContext
export type AccountableContext = ApiExtensionContext & {
  accountability: Accountability | null
}

export async function createItemsService<T extends object>({ services, getSchema, database }: BasicContext, table: string) {
  const cls: typeof ItemsService<T> = services.ItemsService
  return new cls(table, {
    schema: await getSchema(),
    knex: database,
  })
}

export async function createAccountableItemsService<T extends object>({ services, accountability, getSchema, database }: AccountableContext, table: string) {
  const cls: typeof ItemsService<T> = services.ItemsService
  return new cls(table, {
    schema: await getSchema(),
    knex: database,
    accountability,
  })
}

export async function createOperationItemsService<T extends object>({ services, getSchema, database }: BasicContext, table: string, operation: string) {
  const cls: typeof ItemsService<T> = services.ItemsService
  return new cls(table, {
    schema: await getSchema(),
    knex: database,
    accountability: {
      role: null,
      roles: [],
      user: null,
      admin: true,
      app: false,
      ip: null,
      origin: `operations/${operation}`,
    },
  })
}

function logError(logger: BasicContext['logger'], err: unknown) {
  logger.error(err)
  throw err
}

export function createOperationsHandler<Options>(fn: OperationHandler<Options>) {
  return async function (params: Options, context: OperationContext) {
    try {
      return await fn(params, context)
    } catch (err: unknown) {
      logError(context.logger, err)
    }
  }
}

export type Meta = Record<string, any> & {
  event: string
  collection: string
  keys: string[]
}
export type HookContext<T = unknown> = AccountableContext & {
  _payload: T
}
type FilterHandler<T = unknown> = (meta: Meta, context: HookContext<T>) => T | Promise<T>
type ActionHandler<T = unknown> = (meta: Meta, context: HookContext<T>) => void | Promise<void>
type ScheduleHandler = (context: BasicContext) => void | Promise<void>
type RegisterFunctions = {
  filter: (event: string, handler: FilterHandler) => void
  action: (event: string, handler: ActionHandler) => void
  schedule: (cron: string, handler: ScheduleHandler) => void
}
type HookConfig = (register: RegisterFunctions) => void

export function defineHook(fn: HookConfig): DirectusHookConfig {
  return (register, hookContext) => {
    fn({
      filter: (event: string, handler: FilterHandler) => {
        register.filter(event, async (payload, meta, context) => {
          try {
            return await handler(
              {
                ...meta,
                keys: meta.keys ?? [],
              } as Meta,
              {
                ...hookContext,
                ...context,
                _payload: payload,
              }
            )
          } catch (err: unknown) {
            logError(hookContext.logger, err)
          }
        })
      },
      action: (event: string, handler: ActionHandler) => {
        register.action(event, (meta, context) => {
          async function run() {
            try {
              let keys = meta.keys ?? []
              if (meta.key) {
                keys.push(meta.key)
              }
              await handler(
                {
                  ...meta,
                  keys,
                } as Meta,
                {
                  ...hookContext,
                  ...context,
                  _payload: meta.payload,
                }
              )
            } catch (err: unknown) {
              logError(hookContext.logger, err)
            }
          }
          void run()
        })
      },
      schedule: (cron: string, handler: ScheduleHandler) => {
        register.schedule(cron, async () => {
          try {
            await handler(hookContext)
          } catch (err: unknown) {
            logError(hookContext.logger, err)
          }
        })
      },
    })
  }
}
export function readTriggerKeys(context: OperationContext) {
  return ((context.data as any).$trigger.keys as string[]) ?? []
}

type PayloadSchema = z.AnyZodObject | z.ZodUnion<[z.AnyZodObject, ...z.AnyZodObject[]]>
export function readTriggerPayload<T extends PayloadSchema>(context: OperationContext, schema: T) {
  if (schema instanceof z.ZodObject) {
    return schema.passthrough().parse((context.data as any).$trigger.payload) as z.infer<T>
  }
  return z.union(schema.options.map((option) => option.passthrough()) as any).parse((context.data as any).$trigger.payload) as z.infer<T>
}
export function readHookPayload<T extends PayloadSchema>(context: HookContext, schema: T) {
  if (schema instanceof z.ZodObject) {
    return schema.passthrough().parse(context._payload) as z.infer<T>
  }
  return z.union(schema.options.map((option) => option.passthrough()) as any).parse(context._payload) as z.infer<T>
}

export async function createTranslationsService(context: EndpointExtensionContext) {
  let { TranslationsService } = context.services
  return new TranslationsService({ schema: await context.getSchema() }) as Omit<TranslationsService, 'translationKeyExists'> & {
    // This is a private very useful method that we want to expose.
    translationKeyExists(key: string, language: string): Promise<boolean>
  }
}

export async function createFilesService(context: BasicContext) {
  let { FilesService } = context.services
  return new FilesService({ schema: await context.getSchema() }) as FilesService
}

type Folder = {
  id: string
  name: string
  parent?: string | null
}
export type FoldersService<T extends Item> = ItemsService<T>
export async function createFoldersService<T extends Folder = Folder>(context: BasicContext) {
  let { FoldersService } = context.services
  return new FoldersService({ schema: await context.getSchema() }) as FoldersService<T>
}

export async function createNotificationsService(context: BasicContext) {
  let { NotificationsService } = context.services
  return new NotificationsService({ schema: await context.getSchema() }) as NotificationsService
}

type Ext = {
  type: 'directus-sdk-utils'
  collection: string
  field: string
  message: string
}
export const FailedValidationError = createError<Ext>('FAILED_VALIDATION', 'invalid field', 400)
