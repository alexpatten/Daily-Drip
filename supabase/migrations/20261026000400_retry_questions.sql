-- Questions a reader missed come back on a later day for another try. Answers live on
-- the device, so the app asks for those questions by id. Only questions already served
-- before today are returned, so this can't be used to read ahead in the bank.
create function public.retry_questions(p_exam text, p_ids bigint[])
returns setof public.daily_questions
language sql
stable
security definer
set search_path = ''
as $$
  select q.*
  from public.daily_questions q
  join public.exams e on e.slug = q.exam
  where q.exam = p_exam
    and q.id = any (p_ids[1:25])
    and case e.kind
      when 'daily' then q.question_date < public.exam_today(p_exam)
      -- Bank exams: the furthest any reader (25 a day) could have reached before today.
      else q.seq <= (public.eastern_today() - e.starts_on) * 25
    end
  order by q.id
$$;
