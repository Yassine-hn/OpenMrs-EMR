# Third-party content in `config/`

## OpenMRS reference application content

Files in `backend/*/upstream/` and the rows kept in `backend/*/adapted/` come from the OpenMRS
O3 Reference Application 3.7.1 content packages
(<https://github.com/openmrs/openmrs-content-referenceapplication>,
<https://github.com/openmrs/openmrs-content-referenceapplication-demo>), as shipped in the image
`openmrs/openmrs-reference-application-3-backend:3.7.1`. The OCL packages contain concepts
from the CIEL dictionary (<https://openconceptlab.org/orgs/CIEL>).

## Algerian administrative divisions

`backend/addresshierarchy/addresshierarchy.csv` is generated from **geoalgeria
2.3.0** (<https://github.com/yasserstudio/geoalgeria>). Only the names and administrative
codes are used, which are under the MIT License:

```
MIT License

Copyright (c) 2025-2026 Yasser's Studio (https://yasser.studio)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The dataset's OpenStreetMap-derived parts (coordinates, boundaries; ODbL) are not used.
