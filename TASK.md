### High Priority
-
### Medium Priority
- Batch requests for syncing. 
- Add feature to change current_phase manually, i,e move from daily -> weekly, etc. This should reset the count when you do this.
### Low Priority
- Add new phase, after 1 year of reviewing monthly, change to once every 3 months, after 2 years of that, change to once every 6 months, after 2 yersa of that. change to once per year indefinitly.
- move /tests into folder next to where they belong. i.e: every pages/AddVerse directory has AddVerse.tsx, Addverse.test.tsx, etc.
- dont require login initially since we are saving to localindexDB and shoul dbe able to sync up later. just if they want to persist across devices.
    - will require id in localdb to be made up until account is made then can sync with supabase id
    - dont make supabase calls (or can we and just not rqeuire auth yet??) can we tell supabaset to make an account??)
### Backlog
- [ ] 
