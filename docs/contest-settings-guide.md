# Contest Settings Guide

This guide explains the controls available when editing an Obsidian Gallery contest.

## Basics

### Name

The public title of the contest. It appears in the contest header, manage list, preview, and contest cards.

### Slug

The URL-safe identifier for the contest. For example, `best-painting-guide` creates the page `/contests/best-painting-guide`.

Change this carefully after sharing links, because old links will stop working unless redirects are added.

### Stage

Stage is the publishing state of the contest record.

- `Draft`: editable setup state. The contest is not considered live.
- `Published`: live state. The contest can appear or be accessed according to its visibility and schedule.
- `Cancelled`: stops the contest without treating it as completed.
- `Archived`: keeps the contest record for history while removing it from active workflows.

Schedule still matters after publishing. A published contest can be upcoming, open for submissions, in moderation, open for voting, closed, or showing results depending on the dates.

### Visibility

Visibility controls who can discover or load the contest.

- `Public`: visible in the contest directory.
- `Unlisted`: not shown in the public directory, but available to users with a direct link.
- `Private`: hidden from non-managers. Direct links return not found for users who cannot manage the contest.

For MVP testing, the two current contests are `Private`.

### Header Image URL

A direct URL for the contest hero/header image. This image is used in the contest header and contest cards.

### Upload Header Image

Uploads a new image file for the contest header. After saving, the uploaded image becomes the header image.

Large images may take a moment to upload. The save button should show a loading state while the upload is in progress.

### Remove Image

Clears the current header image when the form is saved. Use this if the image is wrong or you want the contest to render without a hero image.

### Short Description

A one-line summary used in compact places such as cards and headers.

### Description Card

The longer explanation of the contest. This appears in the contest detail page and preview.

### Rules

The eligibility and scoring text shown to users. This should include what can be submitted, voting rules, judging criteria, and prize or deadline details.

## Accepted Objects

### Projects, Units, Guides

These checkboxes choose what kind of app objects can be nominated.

- `Projects`: good for armies, warbands, collections, or campaign forces.
- `Units`: good for single models, squads, or unit-level painting showcases.
- `Guides`: good for painting recipes, tutorials, and process posts.

The nomination picker only shows objects matching the accepted types.

### Max Nominations Per User

The number of nominations one user can submit to the contest.

For the Path to Glory MVP contest, this is `1`.

### Require Nomination Approval

If enabled, nominations enter a pending moderation state before appearing publicly or becoming voteable.

Use this for open contests where spam, duplicates, or low-effort entries need review. For closed trusted groups, it can be disabled.

## Schedule

All schedule times are stored as exact timestamps and displayed with a timezone.

### Submissions Open

When users can start nominating eligible objects.

### Submissions Close

When nomination submission ends.

### Voting Opens

When ballots become available. This can be the same as submissions close, but usually there is a moderation gap.

### Voting Closes

When ballot submission ends.

## Ballot Settings

### Method

The voting system.

- `Approval`: users select one or more nominees, each selected nominee receives 1 point.
- `Ranked`: users rank nominees. Points are based on rank.

For ranked contests, points are currently calculated from the maximum pick count. A 3-pick ballot gives 3 points to first, 2 to second, and 1 to third. A 2-pick ballot gives 2 points to first and 1 to second.

### Minimum Picks

The fewest nominees a voter may select.

### Maximum Picks

The most nominees a voter may select. In ranked voting, this also determines the top rank score.

### Require Exactly N Selections

If enabled, voters must submit exactly the maximum number of picks.

Use this when ballots should be complete, such as exactly 1st/2nd/3rd place.

### Allow Ballot Changes

If enabled, voters can revise their submitted ballot until voting closes.

### Allow Self Voting

If enabled, users can vote for their own nomination. Usually this should stay off for contests with prizes or competitive scoring.

### Hide Nominee Identity During Voting

If enabled, the nominee owner/nominator identity is hidden while voting is open.

Use this to reduce popularity bias. Leave it off when identity is part of the contest story, such as a campaign group.

### Show Live Results

If enabled, results may be visible before official publication. Use carefully; live results can influence voting behavior.

## Voting Access

### Who Can Vote

Controls voter eligibility.

- `Public authenticated`: any signed-in eligible user can vote.
- `Allowlist`: only users explicitly added to the contest allowlist can vote.
- `Approved nominees only`: only users with approved nominations can vote.

### Minimum Account Age Hours

Requires a user account to be at least this old before voting. This is useful for reducing last-minute fake account voting.

### Minimum Projects To Vote

Requires voters to have at least this many projects in the app.

For the Best Painting Guide MVP contest, this is `1`.

### Minimum Units To Vote

Requires voters to have at least this many units in the app.

For the Best Painting Guide MVP contest, this is `1`.

### Require Verified Email

Requires the voter account to have a confirmed email. This should stay enabled for prize-winning or public contests.

## Eligible Participants

Closed contests can use eligible participants.

Add emails or usernames for invited participants. Existing users can be matched immediately; future users can remain pending until they join.

For the Path to Glory MVP contest, invited participants are the 12 campaign players.

## Moderation

Contest managers can approve, reject, disqualify, or restore nominations.

- `Approve`: makes a nomination eligible for the public gallery and voting.
- `Reject`: removes the nomination from eligibility with a reason.
- `Disqualify`: removes a previously valid nomination from competition.
- `Restore`: returns a nomination to active consideration.

## Results

### Finalize

Calculates result rows from submitted ballots.

### Publish Results

Marks results as published and makes the results page the official outcome.

## Current MVP Contests

### Path to Glory: Coolest Army

- Visibility: Private
- Accepted objects: Projects
- Nominations: one per invited participant
- Voting access: Allowlist
- Ballot: ranked, exactly 2 picks
- Scoring: 1st place 2 points, 2nd place 1 point

### Best Painting Guide

- Visibility: Private during testing
- Accepted objects: Guides
- Nominations: one guide per user
- Voting access: public authenticated
- Ballot: ranked, exactly 3 picks
- Scoring: 1st place 3 points, 2nd place 2 points, 3rd place 1 point
- Anti-abuse: verified email, at least 1 project, at least 1 unit
