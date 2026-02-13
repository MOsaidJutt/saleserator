const { z } = require('zod');

/* ===============================
   Auth Schemas
================================ */

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

/* ===============================
   Activity Logging Schema
================================ */

const activityLogSchema = z.object({
  activityType: z.string().min(1, 'Activity type is required'),

  value: z.number().int().positive('Value must be greater than 0'),

  categoryId: z.number().int().positive().nullable().optional(),

  dateLogged: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .optional(),
}).superRefine((data, ctx) => {
  if (data.activityType !== 'deals' && !data.categoryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'categoryId is required for this activity',
      path: ['categoryId'],
    });
  }
});
/* ===============================
   Middleware Helper
================================ */

function validate(schema) {
  return (req, res, next) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.issues.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
  };
}

module.exports = {
  loginSchema,
  signupSchema,
  activityLogSchema,
  validate
};