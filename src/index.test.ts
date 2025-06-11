import { readHookPayload } from './index'
import { test, expect } from 'vitest'
import { z } from 'zod'

function makePayload(payload: Record<string, any>) {
  return { _payload: payload } as any
}

test('readHookPayload object', () => {
  const schema = z.object({
    foo: z.string(),
  })
  expect(readHookPayload(makePayload({ foo: 'bar' }), schema)).toEqual({
    foo: 'bar',
  })
})

test('readHookPayload object passthrough', () => {
  const schema = z.object({
    foo: z.string(),
  })
  expect(readHookPayload(makePayload({ foo: 'bar', bar: 'baz' }), schema)).toEqual({
    foo: 'bar',
    bar: 'baz',
  })
})

test('readHookPayload object fail', () => {
  const schema = z.object({
    foo: z.string(),
  })
  expect(() => readHookPayload(makePayload({ foo: 3 }), schema)).toThrow()
})

test('readHookPayload union', () => {
  const schema = z.union([
    z.object({
      foo: z.string(),
    }),
    z.object({
      bar: z.string(),
    }),
  ])
  expect(readHookPayload(makePayload({ foo: 'bar' }), schema)).toEqual({
    foo: 'bar',
  })
  expect(readHookPayload(makePayload({ bar: 'baz' }), schema)).toEqual({
    bar: 'baz',
  })
})

test('readHookPayload union passthrough', () => {
  const schema = z.union([
    z.object({
      foo: z.string(),
    }),
    z.object({
      qux: z.string(),
    }),
  ])
  expect(readHookPayload(makePayload({ foo: 'bar', bar: 'baz' }), schema)).toEqual({
    foo: 'bar',
    bar: 'baz',
  })
})

test('readHookPayload manual passthrough', () => {
  const schema = z.object({
    foo: z.string(),
    bar: z
      .object({
        baz: z.string(),
      })
      .passthrough(),
  })
  expect(
    readHookPayload(
      makePayload({
        foo: 'foo-value',
        bar: {
          baz: 'baz-value',
          qux: 'qux-value',
        },
        last: 'last-value',
      }),
      schema
    )
  ).toEqual({
    foo: 'foo-value',
    bar: {
      baz: 'baz-value',
      qux: 'qux-value',
    },
    last: 'last-value',
  })
})

test('readHookPayload partial', () => {
  const schema = z.object({ foo: z.string() }).partial()
  expect(readHookPayload(makePayload({ bar: 'baz' }), schema)).toEqual({ bar: 'baz' })
})

test('readHookPayload partial passthrough', () => {
  const schema = z.object({ foo: z.string() }).partial()
  expect(
    readHookPayload(
      makePayload({
        foo: 'bar',
        bar: 'baz',
      }),
      schema
    )
  ).toEqual({
    foo: 'bar',
    bar: 'baz',
  })
})
