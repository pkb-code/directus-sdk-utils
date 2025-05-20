import type { ItemsService } from '@directus/api/services/items'
import type { FilesService } from '@directus/api/services/files'
import type { FoldersService } from '@directus/api/services/folders'
import type { TranslationsService } from '@directus/api/services/translations'
import type { NotificationsService } from '@directus/api/services/notifications'
import { createError } from '@directus/errors'
import type { ApiExtensionContext, EndpointExtensionContext, HookConfig as DirectusHookConfig, OperationContext, OperationHandler } from '@directus/extensions'
import type { Accountability, Item } from '@directus/types'
import type { z } from 'zod'

type BasicContext = ApiExtensionContext
type AccountableContext = ApiExtensionContext & {
  accountability: Accountability | null
}

export async function createItemsService<T extends Item>({ services, getSchema, database }: BasicContext, table: string) {
  const cls: typeof ItemsService<T> = services.ItemsService
  return new cls(table, {
    schema: await getSchema(),
    knex: database,
  })
}

export async function createAccountableItemsService<T extends Item>({ services, accountability, getSchema, database }: AccountableContext, table: string) {
  const cls: typeof ItemsService<T> = services.ItemsService
  return new cls(table, {
    schema: await getSchema(),
    knex: database,
    accountability,
  })
}

export async function createOperationItemsService<T extends Item>({ services, getSchema, database }: BasicContext, table: string, operation: string) {
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
              },
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
                },
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

export function readTriggerPayload<T extends z.AnyZodObject>(context: OperationContext, schema: T) {
  return schema.passthrough().parse((context.data as any).$trigger.payload) as z.infer<T>
}

export function readTriggerKeys(context: OperationContext) {
  return ((context.data as any).$trigger.keys as string[]) ?? []
}

export function readHookPayload<T extends z.AnyZodObject>(context: HookContext, schema: T) {
  return schema.passthrough().parse(context._payload) as z.infer<T>
}

export async function getTranslationsService(context: EndpointExtensionContext) {
  let { TranslationsService } = context.services
  return new TranslationsService({ schema: await context.getSchema() }) as Omit<TranslationsService, 'translationKeyExists'> & {
    // This is a private very useful method that we want to expose.
    translationKeyExists(key: string, language: string): Promise<boolean>
  }
}

export async function getFilesService(context: BasicContext) {
  let { FilesService } = context.services
  return new FilesService({ schema: await context.getSchema() }) as FilesService
}

export async function getFoldersService(context: BasicContext) {
  let { FoldersService } = context.services
  return new FoldersService({ schema: await context.getSchema() }) as FoldersService
}

export async function getNotificationsService(context: BasicContext) {
  let { NotificationsService } = context.services
  return new NotificationsService({ schema: await context.getSchema() }) as NotificationsService
}

type Ext = {
  type: 'altec'
  collection: string
  field: string
  message: string
}
export const FailedValidationError = createError<Ext>('FAILED_VALIDATION', 'invalid field', 400)
