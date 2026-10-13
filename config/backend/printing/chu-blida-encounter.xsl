<?xml version="1.0" encoding="UTF-8"?>
<!--
  CHU Frantz Fanon de Blida - print layout for forms ("Imprimer cette rencontre").
  Used by the Patient Documents module (encounter printing), configured in
  jsonkeyvalues/adapted/encounterPrinting.json (stylesheetPath). XSL 1.0 + XSL-FO (Apache FOP).
  Input XML: <encounters><encounter> header fields, <formName>, <pages><page><section><question label="">value
  (built by patientdocuments' EncounterXmlBuilder). Unanswered questions have the value "No data recorded";
  they are not printed, and neither are sections without any answer.
-->
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:fo="http://www.w3.org/1999/XSL/Format">

    <xsl:variable name="noData" select="'No data recorded'"/>
    <xsl:variable name="teal" select="'#005d5d'"/>

    <xsl:template match="/">
        <fo:root font-family="Helvetica" font-size="10pt">
            <fo:layout-master-set>
                <fo:simple-page-master master-name="A4" page-height="29.7cm" page-width="21cm"
                                       margin-top="1.2cm" margin-bottom="1.2cm" margin-left="1.8cm" margin-right="1.8cm">
                    <fo:region-body margin-top="3.4cm" margin-bottom="1.8cm"/>
                    <fo:region-before extent="3.2cm"/>
                    <fo:region-after extent="1.4cm"/>
                </fo:simple-page-master>
            </fo:layout-master-set>
            <xsl:apply-templates select="encounters/encounter"/>
        </fo:root>
    </xsl:template>

    <xsl:template match="encounter">
        <xsl:variable name="docId" select="concat('end-', generate-id())"/>
        <fo:page-sequence master-reference="A4" initial-page-number="1">

            <!-- Letterhead, repeated on every page -->
            <fo:static-content flow-name="xsl-region-before">
                <fo:table width="100%" table-layout="fixed">
                    <fo:table-column column-width="58%"/>
                    <fo:table-column column-width="42%"/>
                    <fo:table-body>
                        <fo:table-row>
                            <fo:table-cell>
                                <xsl:if test="logo">
                                    <fo:block>
                                        <fo:external-graphic content-height="14mm" content-width="scale-to-fit">
                                            <xsl:attribute name="src"><xsl:value-of select="logo"/></xsl:attribute>
                                        </fo:external-graphic>
                                    </fo:block>
                                </xsl:if>
                                <fo:block font-size="8pt" color="#444">République Algérienne Démocratique et Populaire</fo:block>
                                <fo:block font-size="8pt" color="#444">Ministère de la Santé</fo:block>
                                <fo:block font-size="11pt" font-weight="bold" color="{$teal}" space-before="1mm">CHU Frantz Fanon - Blida</fo:block>
                                <fo:block font-size="10pt" font-weight="bold">Service de neurochirurgie</fo:block>
                            </fo:table-cell>
                            <fo:table-cell text-align="right">
                                <fo:block font-size="11pt" font-weight="bold"><xsl:value-of select="patientName"/></fo:block>
                                <xsl:for-each select="patientIdentifiers/identifier">
                                    <fo:block font-size="9pt"><xsl:value-of select="@type"/> : <fo:inline font-weight="bold"><xsl:value-of select="."/></fo:inline></fo:block>
                                </xsl:for-each>
                                <xsl:for-each select="personAttributes/attribute">
                                    <fo:block font-size="9pt"><xsl:value-of select="@type"/> : <xsl:value-of select="."/></fo:block>
                                </xsl:for-each>
                                <xsl:if test="encounterDate">
                                    <fo:block font-size="9pt">Date : <xsl:value-of select="encounterDate"/></fo:block>
                                </xsl:if>
                                <xsl:if test="location">
                                    <fo:block font-size="9pt">Lieu : <xsl:value-of select="location"/></fo:block>
                                </xsl:if>
                                <xsl:if test="visitType">
                                    <fo:block font-size="9pt">Visite : <xsl:value-of select="visitType"/></fo:block>
                                </xsl:if>
                            </fo:table-cell>
                        </fo:table-row>
                    </fo:table-body>
                </fo:table>
                <fo:block border-bottom="1.2pt solid {$teal}" space-before="2mm"/>
            </fo:static-content>

            <!-- Footer -->
            <fo:static-content flow-name="xsl-region-after">
                <fo:block border-top="0.5pt solid #bbb" padding-top="1.5mm" font-size="7.5pt" color="#666">
                    <fo:table width="100%" table-layout="fixed">
                        <fo:table-column column-width="75%"/>
                        <fo:table-column column-width="25%"/>
                        <fo:table-body>
                            <fo:table-row>
                                <fo:table-cell>
                                    <fo:block>
                                        <xsl:call-template name="printedBy">
                                            <xsl:with-param name="text" select="printedBy"/>
                                        </xsl:call-template>
                                    </fo:block>
                                    <xsl:if test="customFooterText">
                                        <fo:block><xsl:value-of select="customFooterText"/></fo:block>
                                    </xsl:if>
                                    <fo:block>Document médical confidentiel</fo:block>
                                </fo:table-cell>
                                <fo:table-cell text-align="right">
                                    <fo:block>Page <fo:page-number/> / <fo:page-number-citation ref-id="{$docId}"/></fo:block>
                                </fo:table-cell>
                            </fo:table-row>
                        </fo:table-body>
                    </fo:table>
                </fo:block>
            </fo:static-content>

            <fo:flow flow-name="xsl-region-body">
                <fo:block font-size="15pt" font-weight="bold" text-align="center" color="{$teal}"
                          space-after="6mm">
                    <xsl:value-of select="formName"/>
                </fo:block>

                <xsl:if test="error">
                    <fo:block color="#b00020" space-after="4mm"><xsl:value-of select="error"/></fo:block>
                </xsl:if>

                <xsl:apply-templates select="pages/page"/>

                <!-- Signature -->
                <fo:block space-before="10mm" keep-together.within-page="always">
                    <fo:table width="100%" table-layout="fixed">
                        <fo:table-column column-width="50%"/>
                        <fo:table-column column-width="50%"/>
                        <fo:table-body>
                            <fo:table-row>
                                <fo:table-cell><fo:block/></fo:table-cell>
                                <fo:table-cell>
                                    <fo:block font-weight="bold" text-align="center">Le médecin</fo:block>
                                    <fo:block text-align="center" font-size="8pt" color="#666">Nom, signature et cachet</fo:block>
                                    <fo:block-container border="0.5pt solid #bbb" height="22mm" space-before="2mm"><fo:block/></fo:block-container>
                                </fo:table-cell>
                            </fo:table-row>
                        </fo:table-body>
                    </fo:table>
                </fo:block>
                <fo:block id="{$docId}"/>
            </fo:flow>
        </fo:page-sequence>
    </xsl:template>

    <!-- A page: print its label only if the form has several pages -->
    <xsl:template match="page">
        <xsl:if test="count(../page) &gt; 1 and @label != ''">
            <fo:block font-size="12pt" font-weight="bold" color="{$teal}" space-before="4mm" space-after="2mm"
                      keep-with-next.within-page="always">
                <xsl:value-of select="@label"/>
            </fo:block>
        </xsl:if>
        <xsl:apply-templates select="section[question[normalize-space(.) != $noData] or markdown]"/>
    </xsl:template>

    <!-- A section with at least one answer -->
    <xsl:template match="section">
        <fo:block space-before="3mm" space-after="2mm">
            <xsl:if test="@label != ''">
                <fo:block font-size="10.5pt" font-weight="bold" color="#ffffff" background-color="{$teal}"
                          padding="1mm" padding-left="2mm" space-after="2mm" keep-with-next.within-page="always">
                    <xsl:value-of select="@label"/>
                </fo:block>
            </xsl:if>
            <xsl:apply-templates select="question[normalize-space(.) != $noData] | markdown"/>
        </fo:block>
    </xsl:template>

    <!-- An answered question.
         Short single-line answer (choice, number, short text): "Label : value" on one line.
         Long or multi-line answer: label, then the text below it (line breaks kept). -->
    <xsl:template match="question">
        <xsl:choose>
            <xsl:when test="string-length(normalize-space(.)) &lt;= 60 and not(contains(., '&#10;'))">
                <fo:block margin-left="2mm" space-after="1.2mm" font-size="10pt">
                    <fo:inline font-size="9pt" font-weight="bold" color="#333"><xsl:value-of select="@label"/> : </fo:inline>
                    <xsl:variable name="v" select="normalize-space(.)"/>
                    <xsl:choose>
                        <!-- a date answer comes as YYYY-MM-DD: print it as DD/MM/YYYY -->
                        <xsl:when test="string-length($v) = 10 and substring($v, 5, 1) = '-' and substring($v, 8, 1) = '-'
                                        and translate($v, '0123456789', '') = '--'">
                            <xsl:value-of select="concat(substring($v, 9, 2), '/', substring($v, 6, 2), '/', substring($v, 1, 4))"/>
                        </xsl:when>
                        <xsl:otherwise><xsl:value-of select="$v"/></xsl:otherwise>
                    </xsl:choose>
                </fo:block>
            </xsl:when>
            <xsl:otherwise>
                <fo:block margin-left="2mm" space-after="2mm">
                    <fo:block font-size="9pt" font-weight="bold" color="#333" keep-with-next.within-page="always">
                        <xsl:value-of select="@label"/>
                    </fo:block>
                    <fo:block font-size="10pt" linefeed-treatment="preserve" white-space-collapse="false"
                              wrap-option="wrap" margin-left="2mm">
                        <xsl:value-of select="."/>
                    </fo:block>
                </fo:block>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template match="markdown">
        <fo:block margin-left="2mm" space-after="2mm" font-size="9pt" font-style="italic" color="#555">
            <xsl:value-of select="."/>
        </fo:block>
    </xsl:template>

    <!-- "Printed by NAME (ID) at TIMESTAMP" (English, built by the module) -> "Imprimé le TIMESTAMP".
         The name is left out on purpose: the PDF is rendered by a background task running as the
         system user ("Super User"), not as the person who clicked "Imprimer". -->
    <xsl:template name="printedBy">
        <xsl:param name="text"/>
        <xsl:choose>
            <xsl:when test="starts-with($text, 'Printed by ') and contains($text, ') at ')">
                <xsl:text>Imprimé le </xsl:text>
                <xsl:value-of select="substring-after($text, ') at ')"/>
            </xsl:when>
            <xsl:otherwise><xsl:value-of select="$text"/></xsl:otherwise>
        </xsl:choose>
    </xsl:template>

</xsl:stylesheet>
