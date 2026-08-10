import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RoundAnswerValidationParity0010RoundAnswerValidationParity1786694400000
  implements MigrationInterface
{
  name = 'RoundAnswerValidationParity0010RoundAnswerValidationParity1786694400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "is_valid_round_answer"(
        question_type "base_question_type",
        configured_options jsonb,
        answer_value jsonb
      )
      RETURNS boolean
      LANGUAGE plpgsql
      IMMUTABLE
      AS $$
      DECLARE candidate text;
      BEGIN
        IF answer_value IS NULL OR answer_value = 'null'::jsonb THEN
          RETURN false;
        END IF;

        IF question_type IN ('TEXT', 'LONG_TEXT') THEN
          RETURN jsonb_typeof(answer_value) = 'string'
            AND translate(answer_value #>> '{}', E' \\t\\n\\r\\f\\v', '') <> '';
        END IF;

        IF question_type = 'BOOLEAN' THEN
          RETURN jsonb_typeof(answer_value) = 'boolean';
        END IF;

        IF question_type = 'NUMBER' THEN
          RETURN jsonb_typeof(answer_value) = 'number';
        END IF;

        IF question_type = 'DATE' THEN
          IF jsonb_typeof(answer_value) <> 'string' THEN
            RETURN false;
          END IF;
          candidate := answer_value #>> '{}';
          IF candidate !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
            RETURN false;
          END IF;
          RETURN to_char(to_date(candidate, 'YYYY-MM-DD'), 'YYYY-MM-DD') = candidate;
        END IF;

        IF question_type = 'SINGLE_SELECT' THEN
          IF jsonb_typeof(answer_value) <> 'string'
            OR jsonb_typeof(configured_options) <> 'array' THEN
            RETURN false;
          END IF;
          candidate := answer_value #>> '{}';
          RETURN EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(configured_options) AS configured(option_value)
            WHERE configured.option_value = candidate
          );
        END IF;

        IF question_type = 'MULTI_SELECT' THEN
          IF jsonb_typeof(answer_value) <> 'array'
            OR jsonb_array_length(answer_value) = 0
            OR jsonb_typeof(configured_options) <> 'array' THEN
            RETURN false;
          END IF;
          IF EXISTS (
            SELECT 1
            FROM jsonb_array_elements(answer_value) AS selected(option_value)
            WHERE jsonb_typeof(selected.option_value) <> 'string'
          ) THEN
            RETURN false;
          END IF;
          IF (
            SELECT COUNT(*)
            FROM jsonb_array_elements_text(answer_value)
          ) <> (
            SELECT COUNT(DISTINCT selected.option_value)
            FROM jsonb_array_elements_text(answer_value) AS selected(option_value)
          ) THEN
            RETURN false;
          END IF;
          RETURN NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(answer_value) AS selected(option_value)
            WHERE NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(configured_options) AS configured(option_value)
              WHERE configured.option_value = selected.option_value
            )
          );
        END IF;

        RETURN false;
      END;
      $$
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "is_valid_round_answer"(
        question_type "base_question_type",
        configured_options jsonb,
        answer_value jsonb
      )
      RETURNS boolean
      LANGUAGE plpgsql
      IMMUTABLE
      AS $$
      DECLARE candidate text;
      BEGIN
        IF answer_value IS NULL OR answer_value = 'null'::jsonb THEN
          RETURN false;
        END IF;

        IF question_type IN ('TEXT', 'LONG_TEXT') THEN
          RETURN jsonb_typeof(answer_value) = 'string'
            AND btrim(answer_value #>> '{}') <> '';
        END IF;

        IF question_type = 'BOOLEAN' THEN
          RETURN jsonb_typeof(answer_value) = 'boolean';
        END IF;

        IF question_type = 'NUMBER' THEN
          RETURN jsonb_typeof(answer_value) = 'number';
        END IF;

        IF question_type = 'DATE' THEN
          IF jsonb_typeof(answer_value) <> 'string' THEN
            RETURN false;
          END IF;
          candidate := answer_value #>> '{}';
          IF candidate !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
            RETURN false;
          END IF;
          RETURN to_char(to_date(candidate, 'YYYY-MM-DD'), 'YYYY-MM-DD') = candidate;
        END IF;

        IF question_type = 'SINGLE_SELECT' THEN
          IF jsonb_typeof(answer_value) <> 'string'
            OR jsonb_typeof(configured_options) <> 'array' THEN
            RETURN false;
          END IF;
          candidate := answer_value #>> '{}';
          RETURN EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(configured_options) AS configured(option_value)
            WHERE configured.option_value = candidate
          );
        END IF;

        IF question_type = 'MULTI_SELECT' THEN
          IF jsonb_typeof(answer_value) <> 'array'
            OR jsonb_array_length(answer_value) = 0
            OR jsonb_typeof(configured_options) <> 'array' THEN
            RETURN false;
          END IF;
          IF EXISTS (
            SELECT 1
            FROM jsonb_array_elements(answer_value) AS selected(option_value)
            WHERE jsonb_typeof(selected.option_value) <> 'string'
          ) THEN
            RETURN false;
          END IF;
          IF (
            SELECT COUNT(*)
            FROM jsonb_array_elements_text(answer_value)
          ) <> (
            SELECT COUNT(DISTINCT selected.option_value)
            FROM jsonb_array_elements_text(answer_value) AS selected(option_value)
          ) THEN
            RETURN false;
          END IF;
          RETURN NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(answer_value) AS selected(option_value)
            WHERE NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(configured_options) AS configured(option_value)
              WHERE configured.option_value = selected.option_value
            )
          );
        END IF;

        RETURN false;
      END;
      $$
    `);
  }
}
