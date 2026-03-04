-- Topline: 특정 월의 주차별 체크인 매출 (월 기준)
CREATE OR REPLACE FUNCTION get_topline_weekly_checkin(
  p_branch TEXT,
  p_month INTEGER,
  p_year INTEGER DEFAULT 2026
)
RETURNS TABLE(
  week_num INTEGER,
  start_date DATE,
  end_date DATE,
  ci_amount NUMERIC
) AS $$
DECLARE
  first_day DATE;
  last_day DATE;
  week_start DATE;
  week_end DATE;
  w INTEGER;
BEGIN
  -- 해당 월의 첫날과 마지막날
  first_day := make_date(p_year, p_month, 1);
  last_day := (first_day + INTERVAL '1 month - 1 day')::DATE;
  
  week_start := first_day;
  w := 1;
  
  -- 해당 월의 모든 주를 반환 (7일씩 나눔)
  WHILE week_start <= last_day LOOP
    -- 주의 마지막 날 (시작일 + 6일, 단 월 마지막을 넘지 않음)
    week_end := week_start + 6;
    IF week_end > last_day THEN
      week_end := last_day;
    END IF;
    
    RETURN QUERY
    SELECT 
      w as week_num,
      week_start as start_date,
      week_end as end_date,
      COALESCE(
        (SELECT SUM(rb.payment_amount) 
         FROM raw_bookings rb
         WHERE DATE(rb.check_in_date) >= week_start
           AND DATE(rb.check_in_date) <= week_end
           AND (CASE WHEN p_branch = 'all' THEN TRUE ELSE rb.branch_name = p_branch END))
        +
        (SELECT SUM(hc.ci_amount)
         FROM historical_ci hc
         WHERE (CASE WHEN p_branch = 'all' THEN TRUE ELSE hc.branch_name = p_branch END))
      , 0) as ci_amount;
    
    week_start := week_start + 7;
    w := w + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
