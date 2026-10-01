# Learning path: official OpenMRS 3 videos and courses

An ordered list of the **official** OpenMRS videos and courses that are useful for building
and running this system, **with duplicates removed**. Every link was opened and every
duration was measured on **2026-10-01**: YouTube durations come from the video metadata,
and course durations from the lesson lists on openmrs.org.

**Courses** on openmrs.org are free but need a (free) account: *Register* on the course page.
**YouTube** videos need no account.

> **There is no official video series per user role** (registration clerk, nurse, doctor,
> lab, pharmacy, stock, billing). The videos below teach the platform, configuration and
> development. Role-by-role usage is covered by our own guides in `docs/user-guide/`
> (planned).

## Time estimate

| Path | Video time | Realistic time\* |
| --- | --- | --- |
| **Core** (sections 1–5): what you need to develop and run this system | **about 7 h 00** | **about 14 h**, i.e. 2 full days, or 2 weeks at 1–1.5 h a day |
| Optional / later (section 6) | about 3 h 35 | about 5 h |

\* Realistic time = video time × 2: pausing, rewinding, and **trying each thing on our local
stack** (http://localhost/openmrs/spa). Without the hands-on part you'll remember much less.

## Duplicates removed (don't watch these as well)

| Skipped | Why |
| --- | --- |
| Course [Intro to OpenMRS 3](https://openmrs.org/courses/intro-to-openmrs-3-2/) | Same videos as sections 1 and 3 below. Take the course **instead of** the YouTube links only if you want its quizzes and certificate; it adds one 2-minute lesson ("Powered by Microfrontends"). |
| Its lesson "Bonus: OpenMRS 3 Software Components" (23:12) | The same video as 3.1 "Technical Intro to O3" |
| YouTube [Forms in OpenMRS 3](https://www.youtube.com/watch?v=plzZjmUwB1E) (5:49) and the 2024 shorts [Exploring the Form Builder](https://www.youtube.com/watch?v=-bg8f0eo8LY), [Using the form validator](https://www.youtube.com/watch?v=19NbPQK7wOQ), [Advanced Features of the Form Builder](https://www.youtube.com/watch?v=Y63kDHKkeqA) | Covered in more depth by the Form Builder course (4.1) |
| Anything on `o3-docs.openmrs.org` | That site is retired (pages return 404); its docs moved to the OpenMRS wiki |

---

## 1. Orientation: what O3 is (21 min)

| # | Video | Length | Try it locally |
| --- | --- | --- | --- |
| 1.1 | [O3 Academy: Basics of O3](https://www.youtube.com/watch?v=EzyGnBWMcdA) | 21:18 | Log in, open a demo patient, browse the chart |

## 2. Foundations: data model and concepts (1 h 32)

From the course **[OpenMRS Fundamentals Academy](https://openmrs.org/academy/openmrs-fundamentals-academy/)**
(account needed). Take **only these three lessons**; the rest of the course is in section 6.

| # | Lesson | Length | Why it matters |
| --- | --- | --- | --- |
| 2.1 | Introduction to the OpenMRS Data Model | 35:44 | Patient, visit, encounter, observation, order. Everything else builds on this. |
| 2.2 | Introduction to the Concept Dictionary | 35:22 | Every diagnosis, test, drug and question is a "concept" (the 4,077 imported on first start) |
| 2.3 | Best Practices for Developing and Implementing OpenMRS | 21:12 | Lessons from real hospital deployments |

## 3. Developer core: how O3 is built and extended (2 h 07)

YouTube playlist **[OpenMRS 3: Getting Started with O3 for Developers](https://www.youtube.com/playlist?list=PL5jj7JoBifSkagk7Pt8-sDL05dl6DxGog)**,
in this order:

| # | Video | Length | Try it locally |
| --- | --- | --- | --- |
| 3.1 | [Technical Intro to O3](https://www.youtube.com/watch?v=FOOjC7S2q14) | 23:12 | Compare with our `docker-compose.yml` (gateway, frontend, backend, db) |
| 3.2 | [Design System and Tools](https://www.youtube.com/watch?v=GBeyp_lVwl0) | 7:45 | |
| 3.3 | [Set Up in 10 Mins Using Docker](https://www.youtube.com/watch?v=ohDCXjPBzZ0) | 10:48 | Already done; this is what our repo does |
| 3.4 | [Configure OpenMRS with JSON](https://www.youtube.com/watch?v=flFhiuBz9f8) | 34:45 | Implementer Tools (the gear icon in the O3 UI, as admin) |
| 3.5 | [Live Coding Hello World](https://www.youtube.com/watch?v=hOQze0xSg0I) | 12:46 | A frontend module in `../openmrs-source/frontend/` |
| 3.6 | [APIs: Review of FHIR and REST APIs](https://www.youtube.com/watch?v=GhDeFdKNzkg) | 38:11 | `curl -u admin:Admin123 http://localhost/openmrs/ws/fhir2/R4/Patient` |

## 4. Administrator / implementer (2 h 17)

| # | Item | Length | Notes |
| --- | --- | --- | --- |
| 4.1 | Course **[Form Builder Course](https://openmrs.org/courses/form-builder-course-2/)** (account needed): create, question types, validation, publish | 1:08:56 (10 videos) | Clinical forms are how each department records its data |
| 4.2 | Course **[OpenMRS Concept Management Using OCL](https://openmrs.org/courses/openmrs-concept-management-using-ocl-2/)** (account needed) | 39:38 | How the concept packages we imported are built and maintained |
| 4.3 | [Authentication vs Authorization in OpenMRS](https://www.youtube.com/watch?v=ZyMjLSSHXcM) | 3:46 | Security block 4.3–4.7: needed before creating real users |
| 4.4 | [Roles and Privileges in OpenMRS](https://www.youtube.com/watch?v=QrBpT2qVLpE) | 4:10 | Our demo roles: Doctor, Nurse, Registration Clerk, Inventory… |
| 4.5 | [Proxy Privileges in OpenMRS](https://www.youtube.com/watch?v=TAU45gF575A) | 4:09 | |
| 4.6 | [OpenMRS Sessions](https://www.youtube.com/watch?v=v1UR42a85b4) | 4:55 | The 30-minute timeout we saw in the logs |
| 4.7 | [CSRF and OpenMRS](https://www.youtube.com/watch?v=P42g-maZOkY) | 5:52 | |
| 4.8 | [OpenMRS Billing Module: New Workflows & Auto-Generated Bills](https://www.youtube.com/watch?v=NBS2HsV6JSs) | 5:31 | Billing is installed in our stack |

## 5. Testing (42 min)

| # | Item | Length | Notes |
| --- | --- | --- | --- |
| 5.1 | Course **[Intro to O3 Quality Assurance Automation](https://openmrs.org/academy/intro-to-o3-quality-assurance-automation/)** (account needed): E2E tests with Playwright | 42:18 (4 videos) | How the community tests O3; the basis for our own automated tests later |

---

## 6. Optional / later (about 3 h 35)

| Item | Length | When |
| --- | --- | --- |
| [SDK Set Up](https://www.youtube.com/watch?v=5xFTOlMJUM8) | 13:22 | When we develop a **backend** module (we run with Docker, not the SDK) |
| [Contributing Code](https://www.youtube.com/watch?v=vRk8rZxda58) | 5:59 | If we send fixes upstream to OpenMRS |
| [OCL Mapper: map concepts to ICD-11, SNOMED](https://www.youtube.com/watch?v=K_X9kQ0_sTs) | 10:22 | When deciding the hospital's coding standards (ICD-10/11) |
| Fundamentals Academy, other lessons: Health IT & EMR Systems (32:43), History of OpenMRS (16:54), Software & Products Overview (41:41), the community lessons (36:59 + 29:18 + 5:58 + 20:43) | 3:04:16 | Background; the products overview partly repeats 1.1 |

## Reference while learning

- [Key O3 Repositories (OpenMRS wiki)](https://openmrs.atlassian.net/wiki/spaces/docs/pages/150962486/Key+O3+Repositories): which repository holds which feature.
- Our local copy of that code, at exactly the versions we run: `../openmrs-source/` (see `../openmrs-source/VERSIONS.md`, created by `scripts/fetch-sources.sh`).
- The public demo [dev3.openmrs.org](https://dev3.openmrs.org/openmrs/spa) runs the **development** version, so it can differ from our 3.7.1. Prefer our local stack.
