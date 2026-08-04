-- supabase/migrations/002_grading_defaults.sql
-- Add default grading scales and other application defaults

-- Insert default grading scales for schools
INSERT INTO grading_scales (school_id, name, min_score, max_score, grade, grade_points)
SELECT 
  s.id,
  'Standard' AS name,
  grade_data.min_score,
  grade_data.max_score,
  grade_data.grade,
  grade_data.grade_points
FROM schools s
CROSS JOIN (
  VALUES
	(90, 100, 'A', 4.0),
	(80, 89, 'B+', 3.5),
	(70, 79, 'B', 3.0),
	(60, 69, 'C+', 2.5),
	(50, 59, 'C', 2.0),
	(40, 49, 'D+', 1.5),
	(30, 39, 'D', 1.0),
	(0, 29, 'E', 0.0)
) AS grade_data(min_score, max_score, grade, grade_points)
ON CONFLICT (school_id, name, min_score) DO NOTHING;

-- Default fee categories
INSERT INTO fee_categories (school_id, name, code)
SELECT 
  s.id,
  category_data.name,
  category_data.code
FROM schools s
CROSS JOIN (
  VALUES
	('Tuition', 'TUN'),
	('Laboratory', 'LAB'),
	('Sports', 'SPO'),
	('Library', 'LIB'),
	('Building Fund', 'BLD'),
	('Examination', 'EXAM'),
	('Unifrom', 'UNI')
) AS category_data(name, code)
ON CONFLICT (school_id, name) DO NOTHING;
