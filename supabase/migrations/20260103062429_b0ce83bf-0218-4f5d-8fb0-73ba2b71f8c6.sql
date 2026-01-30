-- Allow students to delete their own clearance requests only if no signatures have been made yet
CREATE POLICY "Students can delete own unsigned requests" 
ON public.clearance_requests 
FOR DELETE 
USING (
  auth.uid() = student_id 
  AND NOT EXISTS (
    SELECT 1 FROM clearance_signatures cs 
    WHERE cs.clearance_request_id = clearance_requests.id 
    AND cs.status != 'pending'
  )
);

-- Allow students to delete signatures from their own requests (cascade when deleting request)
CREATE POLICY "Students can delete signatures from own unsigned requests" 
ON public.clearance_signatures 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM clearance_requests cr 
    WHERE cr.id = clearance_signatures.clearance_request_id 
    AND cr.student_id = auth.uid()
  )
  AND status = 'pending'
);

-- Allow students to delete files from their own requests
CREATE POLICY "Students can delete files from own requests" 
ON public.clearance_files 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM clearance_requests cr 
    WHERE cr.id = clearance_files.clearance_request_id 
    AND cr.student_id = auth.uid()
  )
);