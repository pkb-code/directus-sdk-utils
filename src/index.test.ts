import { readHookPayload } from './index'
import { test, expect } from 'vitest'
import { z } from 'zod'

function makePayload(payload: Record<string, any>) {
  return { _payload: payload } as any
}

test('read hook payload object', () => {
  const schema = z.object({
    foo: z.string(),
  })
  expect(readHookPayload(makePayload({ foo: 'bar' }), schema)).toEqual({
    foo: 'bar',
  })
})

test('read hook payload object passthrough', () => {
  const schema = z.object({
    foo: z.string(),
  })
  expect(readHookPayload(makePayload({ foo: 'bar', bar: 'baz' }), schema)).toEqual({
    foo: 'bar',
    bar: 'baz',
  })
})

test('read hook payload object fail', () => {
  const schema = z.object({
    foo: z.string(),
  })
  expect(() => readHookPayload(makePayload({ foo: 3 }), schema)).toThrow()
})

test('read hook payload union', () => {
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

test('read hook payload union passthrough', () => {
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

test('manual passthrough', () => {
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
